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

    // ── Whisper transcription ──
    if (body.type === "transcription") {
      const audioBytes = Uint8Array.from(atob(body.audio_base64), (c) =>
        c.charCodeAt(0)
      );

      const formData = new FormData();
      formData.append(
        "file",
        new Blob([audioBytes], { type: "audio/m4a" }),
        "audio.m4a"
      );
      formData.append("model", body.model || "whisper-1");
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
    const openaiBody: Record<string, unknown> = {
      model: body.model || "gpt-4o-mini",
      messages: body.messages,
    };

    if (body.temperature !== undefined) openaiBody.temperature = body.temperature;
    if (body.max_tokens !== undefined) openaiBody.max_tokens = body.max_tokens;
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
