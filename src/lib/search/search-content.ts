import { createClient } from "@/lib/supabase/client";
import type { SearchResultRow } from "./format-search-results";

type SupabaseClient = ReturnType<typeof createClient>;

const RESULT_LIMIT = 5;

export type SearchContentResult = {
  modules: SearchResultRow[];
  cases: SearchResultRow[];
};

const EMPTY_RESULT: SearchContentResult = { modules: [], cases: [] };

export async function searchContent(
  supabase: SupabaseClient,
  query: string,
): Promise<SearchContentResult> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_RESULT;

  try {
    const [{ data: modules, error: modulesError }, { data: cases, error: casesError }] =
      await Promise.all([
        supabase
          .from("modules")
          .select("id, title")
          .ilike("title", `%${trimmed}%`)
          .order("title")
          .limit(RESULT_LIMIT),
        supabase
          .from("cases")
          .select("id, title")
          .ilike("title", `%${trimmed}%`)
          .order("title")
          .limit(RESULT_LIMIT),
      ]);

    if (modulesError || casesError) return EMPTY_RESULT;
    return { modules: modules ?? [], cases: cases ?? [] };
  } catch {
    return EMPTY_RESULT;
  }
}
