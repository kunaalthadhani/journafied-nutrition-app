import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Abuse guards for the billable OpenAI paths ──
// The anon key ships in the app bundle, so anyone who reads it can reach this
// function. These guards cap what a single caller can do: only the models the app
// actually uses, bounded payloads, a clamped output-token ceiling, and a per-caller
// rate limit. The rate limit lives in isolate memory, so it is defense in depth,
// not a hard guarantee — a warm isolate throttles a naive hammer but a scale-out or
// cold start resets it. The durable version needs a DB-backed counter.
const CHAT_MODEL_ALLOWLIST = new Set(["gpt-4o-mini", "gpt-4o"]);
const TRANSCRIBE_MODEL_ALLOWLIST = new Set(["whisper-1"]);
const MAX_MESSAGES = 60;
const MAX_MESSAGES_CHARS = 15_000_000; // room for a full-res photo in a vision call
const MAX_AUDIO_B64_CHARS = 34_000_000; // ~25MB decoded, Whisper's file ceiling
const MAX_OUTPUT_TOKENS = 4096;
const RL_WINDOW_MS = 60_000;
const RL_MAX_PER_WINDOW = 40;

const rlHits = new Map<string, number[]>();
function isRateLimited(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RL_WINDOW_MS;
  const hits = (rlHits.get(key) || []).filter((t) => t > windowStart);
  hits.push(now);
  rlHits.set(key, hits);
  if (rlHits.size > 5000) {
    for (const [k, v] of rlHits) {
      if (v.length === 0 || v[v.length - 1] <= windowStart) rlHits.delete(k);
    }
  }
  return hits.length > RL_MAX_PER_WINDOW;
}

// Bucket by the signed-in user when we have a real user token, else by IP. The
// anon key decodes to role "anon" with no per-user sub, so anonymous callers fall
// back to IP. This is only for rate-limit keying, never trusted as auth.
function callerKey(req: Request): string {
  const auth =
    req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  try {
    let payload = jwt.split(".")[1];
    if (payload) {
      payload = payload.replace(/-/g, "+").replace(/_/g, "/");
      while (payload.length % 4) payload += "=";
      const claims = JSON.parse(atob(payload));
      if (claims.role === "authenticated" && typeof claims.sub === "string") {
        return `u:${claims.sub}`;
      }
    }
  } catch {
    /* fall through to IP */
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `ip:${ip || "unknown"}`;
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (!OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();

    // ── Delete the calling user's auth.users record ──
    // Uses service role to admin-delete after the client has already wiped their
    // app_users row + data tables. Required for App Store account-deletion compliance.
    if (body.type === "delete_user") {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        return new Response(
          JSON.stringify({ error: "Service role not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Missing Authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Verify the JWT and extract user id. Never trust a client-supplied user id.
      const jwt = authHeader.replace(/^Bearer\s+/i, "");
      const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
      if (userErr || !userData?.user?.id) {
        return new Response(
          JSON.stringify({ error: "Invalid session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: delErr } = await admin.auth.admin.deleteUser(userData.user.id);
      if (delErr) {
        return new Response(
          JSON.stringify({ error: `Delete failed: ${delErr.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Abuse guards apply to the billable OpenAI paths below (transcription + chat).
    // delete_user returned above and is JWT-verified, so it is exempt.
    if (isRateLimited(callerKey(req))) {
      return jsonError("Too many requests. Slow down and try again shortly.", 429);
    }

    // ── Whisper transcription ──
    if (body.type === "transcription") {
      const model = body.model || "whisper-1";
      if (!TRANSCRIBE_MODEL_ALLOWLIST.has(model)) {
        return jsonError("Unsupported transcription model.", 400);
      }
      if (typeof body.audio_base64 !== "string" || body.audio_base64.length === 0) {
        return jsonError("Missing audio.", 400);
      }
      if (body.audio_base64.length > MAX_AUDIO_B64_CHARS) {
        return jsonError("Audio is too large.", 413);
      }

      const audioBytes = Uint8Array.from(atob(body.audio_base64), (c) =>
        c.charCodeAt(0)
      );

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([audioBytes], { type: "audio/m4a" }),
        "audio.m4a"
      );
      formData.append("model", model);
      if (body.language) formData.append("language", body.language);

      const whisperRes = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: formData,
          // When the client closes the connection (timeout / user backs out)
          // req.signal fires and OpenAI stops billing once the upstream socket dies.
          signal: req.signal,
        }
      );

      if (!whisperRes.ok) {
        const err = await whisperRes.text();
        return new Response(
          JSON.stringify({ error: `Whisper error: ${err}` }),
          { status: whisperRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const whisperData = await whisperRes.json();
      return new Response(JSON.stringify({ text: whisperData.text }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Chat completions (GPT-4o-mini, vision, etc.) ──
    const model = body.model || "gpt-4o-mini";
    if (!CHAT_MODEL_ALLOWLIST.has(model)) {
      return jsonError("Unsupported model.", 400);
    }
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return jsonError("Missing messages.", 400);
    }
    if (body.messages.length > MAX_MESSAGES) {
      return jsonError("Too many messages.", 400);
    }
    if (JSON.stringify(body.messages).length > MAX_MESSAGES_CHARS) {
      return jsonError("Request payload is too large.", 413);
    }

    const openaiBody: Record<string, unknown> = {
      model,
      messages: body.messages,
    };

    if (body.temperature !== undefined) openaiBody.temperature = body.temperature;
    if (body.max_tokens !== undefined) {
      openaiBody.max_tokens = Math.min(
        Math.max(1, Number(body.max_tokens) || 1),
        MAX_OUTPUT_TOKENS
      );
    }
    if (body.response_format) openaiBody.response_format = body.response_format;

    const chatRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(openaiBody),
      // When the client closes the connection (timeout / user backs out)
      // req.signal fires and OpenAI stops billing once the upstream socket dies.
      signal: req.signal,
    });

    if (!chatRes.ok) {
      const err = await chatRes.text();
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${err}` }),
        { status: chatRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const chatData = await chatRes.json();
    return new Response(JSON.stringify(chatData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
