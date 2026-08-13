import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

// The brain is Moonshot, the family's one AI account. Text parsing rides
// the reasoning model, food photos ride kimi-k3 which actually has eyes.
// Whisper transcription stays OpenAI only and optional: no OPENAI_API_KEY
// means voice returns a clear error while everything else works.
const MOONSHOT_API_KEY = Deno.env.get("MOONSHOT_API_KEY");
// k2.6 spends its whole budget thinking and never writes the answer, measured
// at every cap from 2048 to unbounded. k2.7-code truncates on any multi item
// meal. k3 answers all of them, so one model now serves text and vision.
// The env override still works, except for models proven to never answer: the
// MOONSHOT_MODEL secret still says k2.6 and that alone kept food logging dead
// after the code was fixed. Delete the secret and this list stops mattering
const DEAD_TEXT_MODELS = new Set(["kimi-k2.6"]);
const ENV_MODEL = Deno.env.get("MOONSHOT_MODEL");
const MOONSHOT_MODEL = ENV_MODEL && !DEAD_TEXT_MODELS.has(ENV_MODEL) ? ENV_MODEL : "kimi-k3";
const MOONSHOT_VISION_MODEL = Deno.env.get("MOONSHOT_VISION_MODEL") ?? "kimi-k3";
const MOONSHOT_URL = "https://api.moonshot.ai/v1/chat/completions";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
// Measured against the real food prompt: mini returns five correct items in
// under 7 seconds with the strict schema on, where kimi took 77. Photos get
// the frontier tier because portion estimation is worth paying for
const OPENAI_TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-5.4-mini";
const OPENAI_VISION_MODEL = Deno.env.get("OPENAI_VISION_MODEL") ?? "gpt-5.6-terra";
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

    // ── Whisper transcription (OpenAI only, optional) ──
    if (body.type === "transcription") {
      if (!OPENAI_API_KEY) {
        return jsonError("Voice input is not configured yet. Type it instead.", 501);
      }
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

    // ── Chat completions, served by Moonshot ──
    // The client still speaks its old model names; the proxy translates so
    // the app never changes. A message carrying an image routes to the
    // vision model, kimi-k3 has eyes, the reasoning model does not.
    if (!MOONSHOT_API_KEY) {
      return jsonError("MOONSHOT_API_KEY not configured", 500);
    }
    const requested = body.model || "gpt-4o-mini";
    if (!CHAT_MODEL_ALLOWLIST.has(requested)) {
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

    const hasImage = body.messages.some(
      (m: { content?: unknown }) =>
        Array.isArray(m?.content) &&
        (m.content as { type?: string }[]).some((part) => part?.type === "image_url"),
    );
    // ── Which brain answers this call ──
    // OpenAI is fast and honours strict schemas, so it takes food, photos and
    // every short prompt. The coach stays on kimi deliberately: it is free on
    // the family account, and thinking slowly before speaking is a virtue in a
    // coach and a disaster in a parser. No OpenAI key means everything falls
    // back to Moonshot and the app still works
    const wantsCoach = body.call_type === "coach-chat";
    const useOpenAI = !!OPENAI_API_KEY && !wantsCoach;

    const chatBody: Record<string, unknown> = { messages: body.messages };

    if (useOpenAI) {
      // Photos get the frontier tier, portion estimation is where paying more
      // actually buys accuracy. Everything else rides the mini tier
      chatBody.model = hasImage ? OPENAI_VISION_MODEL : OPENAI_TEXT_MODEL;
      // This family rejects max_tokens outright and wants max_completion_tokens
      chatBody.max_completion_tokens = body.max_tokens === undefined
        ? MAX_OUTPUT_TOKENS
        : Math.min(Math.max(256, Number(body.max_tokens) || 1), MAX_OUTPUT_TOKENS);
      // Both of the workarounds Moonshot forced on us go away here. The client's
      // own temperature is honoured again, and a strict schema is passed through
      // as a real constraint instead of being re-explained in prose
      if (body.temperature !== undefined) chatBody.temperature = body.temperature;
      if (body.response_format) chatBody.response_format = body.response_format;
    } else {
      chatBody.model = hasImage ? MOONSHOT_VISION_MODEL : MOONSHOT_MODEL;
      // kimi rejects any temperature but 1, so it is dropped rather than sent
      // The model thinks before it answers, and thinking spends tokens. ALWAYS
      // set a cap: food analysis sends none, and uncapped it ran past the
      // gateway's own limit and died at 150 seconds
      chatBody.max_tokens = body.max_tokens === undefined
        ? MAX_OUTPUT_TOKENS
        : Math.min(Math.max(2048, Number(body.max_tokens) || 1), MAX_OUTPUT_TOKENS);
      // Moonshot returns garbage on strict json_schema. Downgrade: enforce
      // json_object and hand the schema to the model in words
      if (body.response_format?.type === "json_schema") {
        chatBody.response_format = { type: "json_object" };
        const schema = body.response_format.json_schema?.schema;
        if (schema) {
          chatBody.messages = [
            ...(body.messages as unknown[]),
            {
              role: "system",
              content: `Respond with a single JSON object that strictly matches this JSON Schema, no extra keys, no prose: ${JSON.stringify(schema)}`,
            },
          ];
        }
      } else if (body.response_format) {
        chatBody.response_format = body.response_format;
      }
    }

    const upstreamUrl = useOpenAI ? OPENAI_URL : MOONSHOT_URL;
    const upstreamKey = useOpenAI ? OPENAI_API_KEY : MOONSHOT_API_KEY;
    const callUpstream = (payload: Record<string, unknown>) =>
      fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstreamKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        // When the client closes the connection (timeout / user backs out)
        // req.signal fires and the upstream fetch aborts with it.
        signal: req.signal,
      });

    let chatRes = await callUpstream(chatBody);
    let errText = "";

    // Every provider we have used has, at some point, decided one of these
    // params is no longer allowed on one of its models, and answered with a
    // 400 that killed the whole app silently. Rather than hardcode which model
    // tolerates what, drop the offending param and try once more
    if (!chatRes.ok) {
      errText = await chatRes.text();
      const offender = /temperature/i.test(errText)
        ? "temperature"
        : /response_format|json_schema/i.test(errText)
        ? "response_format"
        : null;
      if (chatRes.status === 400 && offender && offender in chatBody) {
        const retryBody = { ...chatBody };
        delete retryBody[offender];
        chatRes = await callUpstream(retryBody);
        if (chatRes.ok) errText = "";
        else errText = await chatRes.text();
      }
    }

    if (!chatRes.ok) {
      return new Response(
        JSON.stringify({ error: `AI error: ${errText}` }),
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
