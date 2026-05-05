import { supabase } from './supabaseClient';

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
    try {
      const parsed = JSON.parse(message);
      message = parsed.message || parsed.error || message;
    } catch {
      // error.message was not JSON, use as-is
    }
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
    throw new Error(error.message || 'Transcription failed');
  }

  return data?.text || '';
}
