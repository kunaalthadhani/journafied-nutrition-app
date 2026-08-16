import { supabase } from './supabaseClient';
import { sanitizeForAI } from '../utils/sanitizeAI';

/**
 * Google search for food, through the proxy so the search key never ships in
 * the bundle.
 *
 * The food model cannot search and does not know regional packaged products.
 * Asked about Modern Bakery bread it says "I DO NOT KNOW THIS PRODUCT"; asked
 * about a Maggi packet it recalls a category average and guesses the pack size.
 * Google knows both. So Google goes first and the model reads what Google says.
 */

const TIMEOUT_MS = 5000;

export interface SearchResult {
  title: string;
  snippet: string;
  link: string;
}

export async function searchNutrition(query: string): Promise<SearchResult[]> {
  if (!supabase || !query.trim()) return [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // "nutrition facts" narrows a food name to the pages that carry the panel
    // rather than recipes and shopping listings
    const { data, error } = await supabase.functions.invoke('kcal-proxy', {
      body: { type: 'web_search', query: `${query} nutrition facts calories protein carbs fat` },
    });
    if (error || !data?.results) return [];
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renders results as the block the nutrition prompt reads. Everything Google
 * returned is untrusted text from the open web, so it is sanitised before it
 * goes anywhere near a prompt.
 */
export function resultsToPromptBlock(results: SearchResult[]): string {
  if (!results.length) return '';
  const lines = results.slice(0, 6).map((r, i) =>
    `[${i + 1}] ${sanitizeForAI(r.title)}: ${sanitizeForAI(r.snippet)}`
  );
  return `GOOGLE RESULTS for this food:\n${lines.join('\n')}`;
}
