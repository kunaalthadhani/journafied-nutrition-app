/**
 * Prompt versioning utility.
 *
 * Computes a stable, deterministic hash for a prompt string. Used as a cache-key
 * suffix so that whenever a prompt's text changes, all previously-cached entries
 * automatically invalidate on next read.
 *
 * Uses djb2 — fast, no native dependencies, sufficient for cache-key purposes.
 * Output is a base36 hex string for compactness.
 */
export function hashPrompt(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
    hash = hash | 0;
  }
  return (hash >>> 0).toString(36);
}
