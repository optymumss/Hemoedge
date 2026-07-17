import { createClient } from "@/lib/supabase/server";

export type MemberProgress = {
  userId: string;
  name: string;
  email: string;
  attemptCount: number;
  averageScore: number | null;
};

export type ModuleProgress = {
  moduleId: string;
  title: string;
  attemptCount: number;
  averageScore: number;
};

export async function getOrgProgress(orgId: string) {
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("organization_memberships")
    .select("user_id, profiles(full_name, email)")
    .eq("org_id", orgId);

  const memberIds = (members ?? []).map((m) => m.user_id);

  const { data: attempts } =
    memberIds.length > 0
      ? await supabase
          .from("quiz_attempts")
          .select("user_id, module_id, score, modules(title)")
          .in("user_id", memberIds)
      : { data: [] };

  const byMember = new Map<string, MemberProgress>();
  for (const m of members ?? []) {
    byMember.set(m.user_id, {
      userId: m.user_id,
      name: m.profiles?.full_name || m.profiles?.email || "—",
      email: m.profiles?.email ?? "",
      attemptCount: 0,
      averageScore: null,
    });
  }

  const scoresByMember = new Map<string, number[]>();
  const scoresByModule = new Map<string, { title: string; scores: number[] }>();

  for (const a of attempts ?? []) {
    scoresByMember.set(a.user_id, [...(scoresByMember.get(a.user_id) ?? []), a.score]);
    const moduleEntry = scoresByModule.get(a.module_id) ?? {
      title: a.modules?.title ?? "Untitled module",
      scores: [],
    };
    moduleEntry.scores.push(a.score);
    scoresByModule.set(a.module_id, moduleEntry);
  }

  for (const [userId, scores] of scoresByMember) {
    const entry = byMember.get(userId);
    if (!entry) continue;
    entry.attemptCount = scores.length;
    entry.averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  }

  const moduleProgress: ModuleProgress[] = Array.from(scoresByModule.entries()).map(
    ([moduleId, { title, scores }]) => ({
      moduleId,
      title,
      attemptCount: scores.length,
      averageScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
    }),
  );
  moduleProgress.sort((a, b) => a.averageScore - b.averageScore);

  return {
    members: Array.from(byMember.values()),
    modules: moduleProgress,
  };
}
