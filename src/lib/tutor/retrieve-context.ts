import { createClient } from "@/lib/supabase/server";

export type RetrievedSnippet = { source: string; title: string; text: string };

/**
 * Lexical (Postgres full-text search) retrieval over published content —
 * feature definitions, module descriptions, case descriptions. Deliberately
 * not vector/embedding-based: that would need an embeddings provider (e.g.
 * Voyage AI) this project doesn't have credentials for yet. Full-text
 * search needs nothing beyond what's already in Postgres and is a
 * reasonable v1; swap in vector search later without changing the caller.
 */
export async function retrieveContext(query: string, limit = 6): Promise<RetrievedSnippet[]> {
  const supabase = await createClient();

  const [{ data: features }, { data: modules }, { data: cases }] = await Promise.all([
    supabase
      .from("features")
      .select("title, definition")
      .eq("status", "published")
      .not("definition", "is", null)
      .textSearch("definition", query, { type: "websearch" })
      .limit(limit),
    supabase
      .from("modules")
      .select("title, description")
      .eq("status", "published")
      .not("description", "is", null)
      .textSearch("description", query, { type: "websearch" })
      .limit(limit),
    supabase
      .from("cases")
      .select("title, description")
      .eq("status", "published")
      .not("description", "is", null)
      .textSearch("description", query, { type: "websearch" })
      .limit(limit),
  ]);

  const snippets: RetrievedSnippet[] = [];
  for (const f of features ?? []) {
    if (f.definition) snippets.push({ source: "Feature", title: f.title, text: f.definition });
  }
  for (const m of modules ?? []) {
    if (m.description) snippets.push({ source: "Module", title: m.title, text: m.description });
  }
  for (const c of cases ?? []) {
    if (c.description) snippets.push({ source: "Case", title: c.title, text: c.description });
  }

  return snippets.slice(0, limit);
}
