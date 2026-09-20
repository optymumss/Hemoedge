import { createClient } from "@/lib/supabase/server";

export type RecentCertificate = { id: string; title: string; issuedAt: string };

export async function getRecentCertificates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  limit: number,
): Promise<RecentCertificate[]> {
  try {
    const { data } = await supabase
      .from("certificates")
      .select("id, issued_at, curricula(title, certificate_title)")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map((c) => ({
      id: c.id,
      title: c.curricula?.certificate_title || c.curricula?.title || "Untitled certificate",
      issuedAt: c.issued_at,
    }));
  } catch {
    return [];
  }
}
