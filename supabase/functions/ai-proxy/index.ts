import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

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
