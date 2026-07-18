import { createClient } from "@/lib/supabase/server";

type Item = { id: string; title: string; level: string };

/**
 * Published modules/cases for the learner dashboard. If the learner belongs
 * to an organization, only what that org has chosen from the catalog shows;
 * otherwise (an individual learner) everything published is visible.
 */
export async function getPublishedContent(
  table: "modules" | "cases",
  contentType: "module" | "case",
  orgId: string | null,
): Promise<Item[]> {
  const supabase = await createClient();

  if (!orgId) {
    const { data } = await supabase
      .from(table)
      .select("id, title, level")
      .eq("status", "published")
      .order("title");
    return data ?? [];
  }

  const { data: selections } = await supabase
    .from("org_catalog_selections")
    .select("content_id")
    .eq("org_id", orgId)
    .eq("content_type", contentType);

  const ids = (selections ?? []).map((s) => s.content_id);
  if (ids.length === 0) return [];

  const { data } = await supabase
    .from(table)
    .select("id, title, level")
    .eq("status", "published")
    .in("id", ids)
    .order("title");

  return data ?? [];
}
