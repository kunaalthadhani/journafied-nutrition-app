import { v4 as uuidv4 } from 'uuid';

/**
 * Generate a UUID v4 for use as entity IDs
 * This ensures compatibility with Supabase UUID columns
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Check if a string is a valid UUID format
 */
export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

/**
 * Convert a legacy string ID to UUID if needed
 * For backward compatibility with existing data
 */
export function ensureUUID(id: string | undefined | null): string {
  if (!id) {
    return generateId();
  }
  // If it's already a valid UUID, return it
  if (isValidUUID(id)) {
    return id;
  }
  // Otherwise, generate a new UUID
  // Note: This means old string IDs will get new UUIDs, which is fine for new entries
  return generateId();
}

