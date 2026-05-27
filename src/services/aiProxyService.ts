import { supabase } from './supabaseClient';
import * as Sentry from '@sentry/react-native';

/**
 * AI Proxy Service
 * Routes all AI requests through a Supabase Edge Function.
 * The OpenAI key never leaves the server — the app only sends the request payload.
 */

type ResponseFormat =
  | { type: 'json_object' }
  | { type: 'text' }
  | {
      type: 'json_schema';
      json_schema: {
        name: string;
        strict?: boolean;
        schema: Record<string, any>;
      };
    };

interface AIRequest {
  model: string;
  messages: { role: string; content: string | any[] }[];
  temperature?: number;
  max_tokens?: number;
  response_format?: ResponseFormat;
  call_type?: string;
}

interface AIResponse {
  choices: { message: { content: string } }[];
}

export async function invokeAI(request: AIRequest): Promise<AIResponse> {
  if (!supabase) {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: request,
  });

  if (error) {
    let message = error.message || 'AI request failed';

    // The Edge Function returns the actual OpenAI error in the response body. The
    // supabase-js client wraps it under error.context. Pull that out so callers and dev
    // logs see the real cause (rate limit, schema validation, bad key, etc).
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt);
            message = parsed.error || parsed.message || txt;
          } catch {
            message = txt;
          }
        }
      }
    } catch {
      // best effort, fall through with default message
    }

    if (__DEV__) {
      console.error('[invokeAI] Edge function error for call_type=', request.call_type, 'model=', request.model);
      console.error('[invokeAI] Real error from server:', message);
    }

    // Send to Sentry with tags so we can filter by which AI call failed.
    try {
      Sentry.captureException(new Error(`AI proxy error: ${message}`), {
        tags: {
          ai_call_type: request.call_type || 'unknown',
          ai_model: request.model || 'unknown',
        },
        extra: {
          message_count: request.messages?.length,
          temperature: request.temperature,
          max_tokens: request.max_tokens,
          response_format_type: request.response_format?.type,
        },
      });
    } catch { /* Sentry capture should never break the app */ }

    throw new Error(message);
  }

  if (!data) {
    throw new Error('No response from AI proxy');
  }

  return data as AIResponse;
}

export async function invokeWhisper(audioBase64: string): Promise<string> {
  if (!supabase) {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: {
      type: 'transcription',
      audio_base64: audioBase64,
      model: 'whisper-1',
      language: 'en',
    },
  });

  if (error) {
    let message = error.message || 'Transcription failed';

    // Same unwrap pattern as invokeAI: pull the real error out of error.context.text()
    // so we see rate limits, quota issues, bad audio etc instead of a generic 5xx.
    try {
      const ctx: any = (error as any).context;
      if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.text();
        if (txt) {
          try {
            const parsed = JSON.parse(txt);
            message = parsed.error || parsed.message || txt;
          } catch {
            message = txt;
          }
        }
      }
    } catch {
      // best effort
    }

    if (__DEV__) {
      console.error('[invokeWhisper] Edge function error:', message);
    }

    try {
      Sentry.captureException(new Error(`Whisper proxy error: ${message}`), {
        tags: {
          ai_call_type: 'whisper-transcription',
          ai_model: 'whisper-1',
        },
        extra: {
          audio_size_bytes: audioBase64?.length,
        },
      });
    } catch { /* Sentry capture must never break the app */ }

    throw new Error(message);
  }

  return data?.text || '';
}
