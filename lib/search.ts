import { prisma } from "@/lib/prisma";

/**
 * Phase-1 search implementation using Postgres full-text + trigram fuzzy
 * matching (see prisma migration for the GIN indexes). Swappable later for
 * Meilisearch/Algolia without touching callers — they all go through this
 * function.
 */
export async function searchPlaces(query: string, limit = 20) {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // to_tsquery with prefix matching on the last term gives autocomplete-style
  // results ("kam" -> "kampala") while remaining index-backed.
  const tsQuery = trimmed
    .split(/\s+/)
    .filter(Boolean)
    .map((term, i, arr) => (i === arr.length - 1 ? `${term}:*` : term))
    .join(" & ");

  const results = await prisma.$queryRaw<
    { id: string; name: string; slug: string; category: string; rank: number }[]
  >`
    SELECT p.id, p.name, p.slug, p.category,
           ts_rank(to_tsvector('english', p.name || ' ' || coalesce(p.description, '')), to_tsquery('english', ${tsQuery})) AS rank
    FROM places p
    WHERE p.status = 'PUBLISHED'
      AND (
        to_tsvector('english', p.name || ' ' || coalesce(p.description, '')) @@ to_tsquery('english', ${tsQuery})
        OR p.name ILIKE ${"%" + trimmed + "%"}
      )
    ORDER BY rank DESC NULLS LAST, p.featured DESC
    LIMIT ${limit};
  `;

  return results;
}
