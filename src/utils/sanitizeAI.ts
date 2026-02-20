/**
 * Sanitize user-controlled strings before sending to AI models.
 *
 * Defends against prompt injection by:
 * 1. Stripping sequences that attempt to impersonate system/assistant roles
 * 2. Removing common override phrases ("ignore previous instructions", etc.)
 * 3. Enforcing a maximum length to prevent token-stuffing attacks
 * 4. Stripping control characters that could confuse tokenizers
 */

const INJECTION_PATTERNS = [
  // Role impersonation
  /\b(system|assistant)\s*:/gi,
  /\[\s*(SYSTEM|INST|SYS)\s*\]/gi,
  /<<\s*SYS\s*>>/gi,
  // Override / ignore directives
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|context)/gi,
  /override\s+(system|previous|all)\s*(prompt|instructions?|rules?)?/gi,
  /\bprompt\s+(injection|override|hack)\b/gi,
  /\bnew\s+instructions?\s*:/gi,
  /\byou\s+are\s+now\b/gi,
  /\bforget\s+(everything|all|your)\b/gi,
  /\bdo\s+not\s+follow\b/gi,
];

/**
 * Sanitize a single user string for AI consumption.
 * @param input  The raw user text (food name, chat message, exercise description, etc.)
 * @param maxLen Maximum character length (default 2000)
 */
export function sanitizeForAI(input: string, maxLen = 2000): string {
  if (!input) return '';

  let cleaned = input;

  // Strip control characters (keep newlines and tabs for readability)
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Remove injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Collapse excessive whitespace left after stripping
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();

  // Enforce length limit
  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen);
  }

  return cleaned;
}

/**
 * Sanitize an object's string values recursively (for JSON payloads sent to AI).
 * Non-string values are passed through unchanged.
 */
export function sanitizeObjectForAI(obj: any, maxFieldLen = 500): any {
  if (typeof obj === 'string') return sanitizeForAI(obj, maxFieldLen);
  if (Array.isArray(obj)) return obj.map(item => sanitizeObjectForAI(item, maxFieldLen));
  if (obj && typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeObjectForAI(value, maxFieldLen);
    }
    return result;
  }
  return obj;
}
