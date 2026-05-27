import { supabase } from './supabaseClient';
import * as Sentry from '@sentry/react-native';

/**
 * AI Proxy Service
 * Routes all AI requests through a Supabase Edge Function.
 * The OpenAI key never leaves the server — the app only sends the request payload.
 *
 * Cancellation: each call uses an AbortController. When the timeout fires (or a
 * caller-supplied signal aborts), supabase-js closes the underlying fetch, which
 * propagates to req.signal inside the Edge Function, which aborts the upstream
 * OpenAI fetch. End result: no zombie billing on stuck calls.
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
  // Default 60s. Generous because GPT-4o + strict json_schema can take 20-30s
  // under load. Override on calls that should fail fast (e.g. cheap completions).
  timeout_ms?: number;
  // Optional caller signal — lets a screen cancel the request on unmount.
  // Composed with the internal timeout signal.
  signal?: AbortSignal;
}

interface AIResponse {
  choices: { message: { content: string } }[];
}

const DEFAULT_AI_TIMEOUT_MS = 60_000;

function isAbortError(e: any): boolean {
  if (!e) return false;
  if (e.name === 'AbortError') return true;
  const msg = (e.message || '').toLowerCase();
  return msg.includes('abort') || msg.includes('aborted');
}

export async function invokeAI(request: AIRequest): Promise<AIResponse> {
  if (!supabase) {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  const timeoutMs = request.timeout_ms ?? DEFAULT_AI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // If the caller passed their own signal, abort our controller when it fires
  // so the timeout race short-circuits as well.
  const callerSignal = request.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  let data: any = null;
  let error: any = null;
  try {
    const result = await supabase.functions.invoke('ai-proxy', {
      body: {
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        response_format: request.response_format,
        call_type: request.call_type,
      },
      // supabase-js passes this through to the underlying fetch. When
      // controller.abort() fires, the HTTP connection closes, which closes req
      // in the Edge Function, which aborts the OpenAI fetch.
      signal: controller.signal,
    });
    data = result.data;
    error = result.error;
  } catch (err: any) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

    const aborted = controller.signal.aborted || isAbortError(err);
    const isTimeout = aborted && !callerSignal?.aborted;
    const message = isTimeout
      ? `AI proxy (${request.call_type || 'unknown'}) timed out after ${timeoutMs}ms`
      : (err?.message || 'AI request failed');

    if (__DEV__) console.error('[invokeAI]', message);

    try {
      Sentry.captureException(new Error(message), {
        tags: {
          ai_call_type: request.call_type || 'unknown',
          ai_model: request.model || 'unknown',
          ai_timeout: isTimeout ? 'true' : 'false',
          ai_aborted: aborted ? 'true' : 'false',
        },
        extra: { timeout_ms: timeoutMs, message_count: request.messages?.length },
      });
    } catch { /* Sentry must never break the app */ }

    throw new Error(message);
  }
  clearTimeout(timer);
  if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

  if (error) {
    let message = error.message || 'AI request failed';

    // Edge Function returns the actual OpenAI error in the body. supabase-js wraps it
    // under error.context. Pull it out so logs show the real cause (rate limit, schema
    // validation, bad key, etc) instead of a generic non-2xx.
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
      console.error('[invokeAI] Edge function error for call_type=', request.call_type, 'model=', request.model);
      console.error('[invokeAI] Real error from server:', message);
    }

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
    } catch { /* Sentry must never break the app */ }

    throw new Error(message);
  }

  if (!data) {
    throw new Error('No response from AI proxy');
  }

  return data as AIResponse;
}

export async function invokeWhisper(audioBase64: string, options?: { timeout_ms?: number; signal?: AbortSignal }): Promise<string> {
  if (!supabase) {
    throw new Error('OPENAI_API_KEY_NOT_CONFIGURED');
  }

  const timeoutMs = options?.timeout_ms ?? DEFAULT_AI_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const callerSignal = options?.signal;
  const onCallerAbort = () => controller.abort();
  if (callerSignal) {
    if (callerSignal.aborted) controller.abort();
    else callerSignal.addEventListener('abort', onCallerAbort);
  }

  let data: any = null;
  let error: any = null;
  try {
    const result = await supabase.functions.invoke('ai-proxy', {
      body: {
        type: 'transcription',
        audio_base64: audioBase64,
        model: 'whisper-1',
        language: 'en',
      },
      signal: controller.signal,
    });
    data = result.data;
    error = result.error;
  } catch (err: any) {
    clearTimeout(timer);
    if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

    const aborted = controller.signal.aborted || isAbortError(err);
    const isTimeout = aborted && !callerSignal?.aborted;
    const message = isTimeout
      ? `Whisper transcription timed out after ${timeoutMs}ms`
      : (err?.message || 'Transcription failed');

    if (__DEV__) console.error('[invokeWhisper]', message);

    try {
      Sentry.captureException(new Error(message), {
        tags: {
          ai_call_type: 'whisper-transcription',
          ai_model: 'whisper-1',
          ai_timeout: isTimeout ? 'true' : 'false',
          ai_aborted: aborted ? 'true' : 'false',
        },
        extra: { timeout_ms: timeoutMs, audio_size_bytes: audioBase64?.length },
      });
    } catch { /* */ }

    throw new Error(message);
  }
  clearTimeout(timer);
  if (callerSignal) callerSignal.removeEventListener('abort', onCallerAbort);

  if (error) {
    let message = error.message || 'Transcription failed';

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

    if (__DEV__) console.error('[invokeWhisper] Edge function error:', message);

    try {
      Sentry.captureException(new Error(`Whisper proxy error: ${message}`), {
        tags: {
          ai_call_type: 'whisper-transcription',
          ai_model: 'whisper-1',
        },
        extra: { audio_size_bytes: audioBase64?.length },
      });
    } catch { /* Sentry must never break the app */ }

    throw new Error(message);
  }

  return data?.text || '';
}
