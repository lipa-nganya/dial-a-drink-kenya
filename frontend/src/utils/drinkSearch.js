/**
 * Customer menu search: match drink **name** only, case-insensitive.
 */

export function normalizeSearchQuery(q) {
  return (q || '').trim().toLowerCase();
}

/** True if drink name contains the query substring (case-insensitive). */
export function drinkNameMatchesSearch(drink, query) {
  const q = normalizeSearchQuery(query);
  if (!q || !drink?.name || typeof drink.name !== 'string') return false;
  return drink.name.toLowerCase().includes(q);
}

/** Filter drinks by name-only substring match. */
export function filterDrinksByNameOnly(drinks, query) {
  if (!Array.isArray(drinks)) return [];
  const q = normalizeSearchQuery(query);
  if (!q) return drinks.filter(Boolean);
  return drinks.filter((d) => d && drinkNameMatchesSearch(d, query));
}

/**
 * When a search returns no exact name matches, suggest related items:
 * score by token overlap with the query vs drink name, boost same category,
 * then fall back to popular / available items.
 */
export function getSimilarDrinkSuggestions(drinks, query, selectedCategoryId, { limit = 12 } = {}) {
  if (!Array.isArray(drinks) || drinks.length === 0) return [];
  const q = normalizeSearchQuery(query);
  const cap = Math.max(1, Math.min(24, limit));

  const basePool = drinks.filter((d) => d && d.name);
  if (!q) {
    return basePool
      .filter((d) => d.isAvailable)
      .sort((a, b) => {
        if (a.isPopular !== b.isPopular) return a.isPopular ? -1 : 1;
        return (Number(b.clicks) || 0) - (Number(a.clicks) || 0);
      })
      .slice(0, cap);
  }

  const queryTokens = q.split(/[^a-z0-9]+/i).filter((t) => t.length >= 2);

  const scored = basePool.map((d) => {
    const nameLower = d.name.toLowerCase();
    const nameTokens = nameLower.split(/[^a-z0-9]+/i).filter((t) => t.length >= 2);
    let score = 0;

    for (const qt of queryTokens) {
      if (nameLower.includes(qt)) score += 4;
      for (const nt of nameTokens) {
        if (nt.includes(qt) || qt.includes(nt)) score += 2;
        else if (qt.length >= 3 && (nt.startsWith(qt.slice(0, 3)) || qt.startsWith(nt.slice(0, 3)))) {
          score += 1;
        }
      }
    }

    if (selectedCategoryId > 0 && d.categoryId === selectedCategoryId) score += 3;
    if (d.isPopular) score += 1;
    if (d.isAvailable) score += 0.5;

    return { drink: d, score };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (Number(b.drink.clicks) || 0) - (Number(a.drink.clicks) || 0) ||
      (a.drink.name || '').localeCompare(b.drink.name || '')
  );

  let result = scored.filter((x) => x.score > 0).map((x) => x.drink);
  if (result.length >= Math.min(4, cap)) return result.slice(0, cap);

  const seen = new Set();
  const merged = [];
  const pushUnique = (arr) => {
    for (const d of arr) {
      if (!d || merged.length >= cap) break;
      if (!seen.has(d.id)) {
        seen.add(d.id);
        merged.push(d);
      }
    }
  };

  pushUnique(result);

  const popular = basePool.filter((d) => d.isAvailable && d.isPopular);
  pushUnique(popular);

  const available = basePool.filter((d) => d.isAvailable);
  pushUnique(available);

  return merged.slice(0, cap);
}
