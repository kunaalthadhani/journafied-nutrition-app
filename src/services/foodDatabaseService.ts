import { sanitizeForAI } from '../utils/sanitizeAI';

/**
 * Open Food Facts lookup for packaged, branded food.
 *
 * The model cannot search and does not know Gulf packaged products. Asked
 * directly it answers "I DO NOT KNOW THIS PRODUCT". Open Food Facts does know
 * them, for free, with no API key, and it is the same data a Google search
 * surfaces for these items: for Modern Bakery Protein Bread every figure it
 * returns matches Google's answer to the gram.
 *
 * A hit here is not an estimate. It is a label, and it goes to the nutrition
 * pass as a LABEL PANEL line, which that prompt already treats as manufacturer
 * truth that outranks its own guess.
 */

const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const UA = 'TrackKcal/1.0 (trackkcal@gmail.com)';
const TIMEOUT_MS = 4000;

// Words that carry no identifying power. "high protein bread" must not match a
// random protein drink on the strength of "high" and "protein" alone.
const STOPWORDS = new Set([
  'the', 'and', 'with', 'for', 'from', 'pcs', 'pieces', 'piece', 'slice', 'slices',
  'high', 'low', 'light', 'lite', 'free', 'zero', 'plus', 'boost', 'natural',
  'fresh', 'original', 'classic', 'new', 'pack', 'packet', 'box', 'bag', 'bottle',
  'can', 'cup', 'serving', 'servings', 'gram', 'grams', 'kg', 'ml', 'litre', 'liter',
  // Generic descriptors. Left in, they matched "Almarai full fat milk" to
  // "Almarai cheddar cheese full fat" on the strength of "full" and "fat",
  // which is a four-fold calorie error dressed up as a label
  'full', 'fat', 'skimmed', 'semi', 'whole', 'reduced', 'extra', 'super',
  'large', 'small', 'medium', 'mini', 'big', 'double', 'triple', 'half',
  'bar', 'bars', 'stick', 'sticks', 'roll', 'rolls', 'sachet', 'tub', 'pot',
  'flavour', 'flavor', 'flavoured', 'flavored', 'style', 'premium', 'value',
]);

// Units glued to a number ("250ml", "500g") are quantity, not identity
const isQuantity = (t: string) => /^\d+(\.\d+)?(g|kg|ml|l|oz|lb|lbs|cl)?$/.test(t);

/**
 * Words that change what the food physically IS, not just how it is described.
 * "Almarai milk" matched "Almarai Milk Powder" on a perfect two of two token
 * score, and milk powder is roughly eight times the calories of milk. If the
 * product carries one of these and the user did not say it, it is a different
 * food wearing a similar name.
 */
const FORM_WORDS = new Set([
  'powder', 'powdered', 'dried', 'dehydrated', 'concentrate', 'concentrated',
  'syrup', 'extract', 'essence', 'paste', 'sauce', 'oil', 'mix', 'seasoning',
  'frozen', 'raw', 'uncooked', 'instant', 'sweetened', 'condensed', 'evaporated',
  'flour', 'crisps', 'chips', 'biscuit', 'biscuits', 'cake', 'ice',
]);

export interface FoodLabel {
  name: string;
  brand: string | null;
  code: string;
  servingSize: string | null;
  /** Pack size as printed, e.g. "440 g". Often the only clue to piece weight. */
  quantity: string | null;
  /** Per 100g, already normalised to the totals convention this app uses. */
  per100g: {
    calories: number;
    protein: number;
    /** TOTAL carbohydrate, fibre included. Open Food Facts reports EU style, where its carbohydrate figure EXCLUDES fibre, so fibre is added back here. */
    carbs: number;
    fibre: number;
    sugar: number | null;
    fat: number;
    saturatedFat: number | null;
    sodiumMg: number | null;
  };
}

const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const tokens = (s: string): string[] =>
  s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t) && !isQuantity(t));

/**
 * Open Food Facts is crowd sourced and carries impossible rows. One Modern
 * Bakery entry claims 986 kcal and 217g of carbohydrate per 100g, which is more
 * carbohydrate than there is food. Anything that fails arithmetic is dropped
 * rather than shown to a user as a label.
 */
const isSane = (l: FoodLabel['per100g']): boolean => {
  const mass = l.protein + l.carbs + l.fat;
  if (mass > 100) return false;
  if (l.calories <= 0 || l.calories > 900) return false;
  if (l.fibre > l.carbs) return false;
  const implied = l.protein * 4 + Math.max(0, l.carbs - l.fibre) * 4 + l.fibre * 2 + l.fat * 9;
  return Math.abs(implied - l.calories) / l.calories <= 0.30;
};

const toLabel = (hit: any): FoodLabel | null => {
  const n = hit?.nutriments || {};
  const calories = num(n['energy-kcal_100g']);
  const protein = num(n.proteins_100g);
  const netCarbs = num(n.carbohydrates_100g);
  const fat = num(n.fat_100g);
  if (calories == null || protein == null || netCarbs == null || fat == null) return null;

  const fibre = num(n.fiber_100g) ?? 0;
  const per100g = {
    calories,
    protein,
    carbs: netCarbs + fibre,
    fibre,
    sugar: num(n.sugars_100g),
    fat,
    saturatedFat: num(n['saturated-fat_100g']),
    // Open Food Facts reports salt in grams. Sodium is salt / 2.5
    sodiumMg: num(n.sodium_100g) != null
      ? Math.round((num(n.sodium_100g) as number) * 1000)
      : num(n.salt_100g) != null ? Math.round((num(n.salt_100g) as number) / 2.5 * 1000) : null,
  };
  if (!isSane(per100g)) return null;

  const name = typeof hit.product_name === 'string' ? hit.product_name : null;
  if (!name) return null;
  const brandRaw = Array.isArray(hit.brands) ? hit.brands[0] : hit.brands;

  return {
    name,
    brand: typeof brandRaw === 'string' ? brandRaw : null,
    code: String(hit.code ?? ''),
    servingSize: typeof hit.serving_size === 'string' ? hit.serving_size : null,
    quantity: typeof hit.quantity === 'string' ? hit.quantity : null,
    per100g,
  };
};

/**
 * Full text search returns five results whether or not any of them are right,
 * so rank alone proves nothing. A hit only counts when enough distinctive words
 * from what the user typed actually appear in the product.
 */
/**
 * A packaged label is only the truth about a packaged thing. "chicken shawarma
 * wrap with garlic sauce" matched a Bazza Chicken Shawarma Wrap and collapsed a
 * dish that should have been broken into bread, chicken and sauce into one
 * high-confidence row for somebody else's product. So the user has to have
 * actually named the maker. The brand field is often empty on search results,
 * in which case the front of the product name stands in for it.
 */
/**
 * Foods, not makers. A row named "Chicken shawarma wrap" with no brand cannot
 * use its own first words as a stand-in brand, or every dish matches a packaged
 * version of itself. "Modern Bakery" can, because nobody eats a modern.
 */
export const FOOD_WORDS = new Set([
  // proteins
  'chicken', 'beef', 'lamb', 'mutton', 'goat', 'veal', 'pork', 'bacon', 'ham',
  'fish', 'tuna', 'salmon', 'cod', 'hammour', 'prawn', 'prawns', 'shrimp', 'crab',
  'egg', 'eggs', 'omelette', 'omelet', 'tofu', 'paneer', 'lentil', 'lentils', 'dal',
  'chickpea', 'chickpeas', 'beans', 'mince', 'keema', 'kofta', 'patty', 'breast',
  'thigh', 'wing', 'wings', 'drumstick', 'fillet', 'steak', 'sausage', 'meat',
  // dairy
  'cheese', 'cheddar', 'mozzarella', 'feta', 'halloumi', 'milk', 'yoghurt', 'yogurt',
  'labneh', 'butter', 'ghee', 'cream', 'curd', 'raita', 'lassi',
  // carbs and breads
  'rice', 'basmati', 'bread', 'toast', 'pasta', 'spaghetti', 'penne', 'macaroni',
  'noodle', 'noodles', 'potato', 'potatoes', 'fries', 'chips', 'oats', 'oatmeal',
  'cereal', 'khaboos', 'kuboos', 'khubz', 'roti', 'chapati', 'paratha', 'naan',
  'pita', 'tortilla', 'bun', 'croissant', 'bagel', 'couscous', 'quinoa', 'poha',
  // dishes
  'salad', 'soup', 'sandwich', 'wrap', 'burger', 'cheeseburger', 'pizza', 'taco',
  'burrito', 'shawarma', 'shwarma', 'biryani', 'briyani', 'machboos', 'majboos',
  'kabsa', 'mandi', 'madhbi', 'harees', 'thareed', 'saloona', 'kebab', 'kabab',
  'tikka', 'karahi', 'korma', 'curry', 'masala', 'butter chicken', 'vindaloo',
  'rogan', 'josh', 'pulao', 'pilaf', 'khichdi', 'dosa', 'idli', 'sambar', 'vada',
  'samosa', 'pakora', 'bhaji', 'chaat', 'falafel', 'hummus', 'moutabel', 'tabbouleh',
  'fattoush', 'manakish', 'manakeesh', 'fatayer', 'sambousek', 'grill', 'mixed',
  'kunafa', 'knafeh', 'baklava', 'luqaimat', 'halwa', 'kheer', 'gulab', 'jamun',
  // produce
  'tomato', 'onion', 'garlic', 'cucumber', 'lettuce', 'spinach', 'carrot', 'pepper',
  'broccoli', 'cabbage', 'aubergine', 'eggplant', 'courgette', 'okra', 'peas', 'corn',
  'apple', 'banana', 'mango', 'orange', 'grape', 'grapes', 'date', 'dates', 'melon',
  'watermelon', 'strawberry', 'berries', 'avocado', 'lemon', 'lime', 'pineapple',
  // fats, sauces, extras
  'oil', 'olive', 'mayo', 'mayonnaise', 'ketchup', 'mustard', 'tahini', 'sauce',
  'dressing', 'pickle', 'pickles', 'nuts', 'almond', 'almonds', 'cashew', 'peanut',
  'seeds', 'honey', 'sugar', 'salt', 'spices', 'herbs', 'coriander', 'mint',
  // drinks
  'coffee', 'karak', 'tea', 'chai', 'juice', 'water', 'soda', 'cola', 'smoothie',
  'shake', 'milkshake', 'latte', 'cappuccino', 'espresso',
  // preparation and generic descriptors
  'grilled', 'fried', 'roasted', 'baked', 'boiled', 'steamed', 'raw', 'cooked',
  'homemade', 'home', 'plate', 'bowl', 'portion', 'protein', 'chocolate', 'vanilla',
  'strawberry', 'plain', 'spicy', 'sweet', 'savoury', 'savory',
]);

/**
 * Cheap gate for the paid lookups. If every distinctive word the user typed is
 * an ordinary food word, nobody manufactured this and there is nothing to look
 * up: "chicken biryani" is a dish, "modern bakery khaboos" is a product. Getting
 * it wrong is cheap in both directions, a wasted search or a fallback estimate,
 * so it errs toward searching.
 */
export const mentionsSomethingUnfamiliar = (query: string): boolean =>
  tokens(query).some(t => !FOOD_WORDS.has(t));

const namedTheBrand = (asked: Set<string>, label: FoodLabel): boolean => {
  if (label.brand) {
    const brandTokens = tokens(label.brand);
    return brandTokens.length > 0 && brandTokens.some(t => asked.has(t));
  }
  // No brand on the row. Its opening words only stand in for one if they could
  // not themselves be the food
  const lead = tokens(label.name).slice(0, 2).filter(t => !FOOD_WORDS.has(t));
  return lead.length > 0 && lead.some(t => asked.has(t));
};

const score = (queryTokens: string[], label: FoodLabel): number => {
  const hay = new Set(tokens(`${label.name} ${label.brand ?? ''}`));
  const asked = new Set(queryTokens);
  if (!namedTheBrand(asked, label)) return 0;
  // A form word the user never said disqualifies the row outright, however
  // well the rest of it scores
  for (const t of hay) if (FORM_WORDS.has(t) && !asked.has(t)) return 0;
  return queryTokens.filter(t => hay.has(t)).length;
};

const MIN_MATCHED_TOKENS = 2;
const MIN_MATCH_RATIO = 0.6;

export async function lookupPackagedFood(query: string): Promise<FoodLabel | null> {
  const q = tokens(query);
  // One distinctive word is not a brand, it is a coincidence waiting to happen
  if (q.length < MIN_MATCHED_TOKENS) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Search the distinctive words, never the raw sentence. "Modern bakery high
    // protein khaboos 3 pcs" returned mackerel and sardines, because "3" and
    // "pcs" are noise the relevance ranker takes as seriously as the brand.
    // The same query minus the quantity puts the right bread at rank one.
    const url = `${SEARCH_URL}?q=${encodeURIComponent(q.join(' '))}&page_size=5`;
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const hits: any[] = Array.isArray(data?.hits) ? data.hits : [];

    let best: FoodLabel | null = null;
    let bestScore = 0;
    for (const hit of hits) {
      const label = toLabel(hit);
      if (!label) continue;
      const s = score(q, label);
      if (s > bestScore) { best = label; bestScore = s; }
    }
    // Both bars must clear. A raw count alone lets a long query match on its
    // throwaway words; a ratio alone lets a two word query match on one
    return bestScore >= MIN_MATCHED_TOKENS && bestScore / q.length >= MIN_MATCH_RATIO
      ? best
      : null;
  } catch {
    // A lookup that fails is a lookup that did not happen. The estimate path
    // still runs, so a slow or down database can never block a log
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Renders a label as the LABEL PANEL block the nutrition prompt already knows
 * how to obey. Same wire format the photo reader uses when it transcribes a
 * panel off a wrapper, so there is one authoritative-numbers path, not two.
 */
export function labelToPanelLine(label: FoodLabel): string {
  const p = label.per100g;
  const rows = [
    `calories ${Math.round(p.calories)}`,
    `protein ${p.protein}g`,
    `carbs ${Math.round(p.carbs * 10) / 10}g total including fibre`,
    `fibre ${p.fibre}g`,
    p.sugar != null && `sugar ${p.sugar}g`,
    `fat ${p.fat}g`,
    p.saturatedFat != null && `saturated fat ${p.saturatedFat}g`,
    p.sodiumMg != null && `sodium ${p.sodiumMg}mg`,
  ].filter(Boolean).join(', ');

  const name = sanitizeForAI([label.brand, label.name].filter(Boolean).join(' '));
  // Piece weight is the one thing the panel cannot tell us, and it is now the
  // largest remaining source of error, so hand over every clue the record holds
  const serving = label.servingSize ? ` Stated serving: ${sanitizeForAI(label.servingSize)}.` : '';
  const pack = label.quantity ? ` Pack size: ${sanitizeForAI(label.quantity)}.` : '';
  return `LABEL PANEL for ${name} (per 100g): ${rows}.${serving}${pack} Source: Open Food Facts barcode ${label.code}.`;
}
