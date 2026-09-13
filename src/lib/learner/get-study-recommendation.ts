import { createClient } from "@/lib/supabase/server";
import { getCompetencyRows } from "./competency-rows";
import { getPublishedContent } from "@/lib/learner/published-content";
import {
  pickStudyRecommendation,
  type CompetencyArea,
  type CompetencyCandidate,
  type PathwayModule,
  type StudyRecommendation,
} from "./study-recommendation";

async function getAssignedPathwayModules(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<PathwayModule[]> {
  // Only org-assigned learners have an "assigned" pathway — a self-directed
  // learner can browse any published curriculum, so none of them count as
  // "assigned" for this recommendation.
  if (!orgId) return [];

  const { data: selections } = await supabase
    .from("org_catalog_selections")
    .select("content_id")
    .eq("org_id", orgId)
    .eq("content_type", "curriculum");
  const curriculumIds = (selections ?? []).map((s) => s.content_id);
  if (curriculumIds.length === 0) return [];

  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, title, pass_threshold")
    .eq("status", "published")
    .in("id", curriculumIds)
    .order("level")
    .limit(1);
  const curriculum = curricula?.[0];
  if (!curriculum) return [];

  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("module_id, modules(id, title)")
    .eq("curriculum_id", curriculum.id)
    .order("position");
  const moduleIds = (links ?? []).map((l) => l.module_id);

  const { data: attempts } =
    moduleIds.length > 0
      ? await supabase
          .from("quiz_attempts")
          .select("module_id, score")
          .eq("user_id", userId)
          .in("module_id", moduleIds)
      : { data: [] };

  const bestByModule = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.module_id) continue;
    bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
  }

  return (links ?? []).map((l) => ({
    moduleId: l.module_id,
    title: l.modules?.title ?? "Untitled module",
    pathwayTitle: curriculum.title,
    bestScore: bestByModule.get(l.module_id) ?? null,
    passThreshold: curriculum.pass_threshold,
  }));
}

async function getCompetencyCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
  weakAreas: CompetencyArea[],
): Promise<Partial<Record<CompetencyArea, CompetencyCandidate>>> {
  const candidates: Partial<Record<CompetencyArea, CompetencyCandidate>> = {};

  const lineageByArea: Partial<Record<CompetencyArea, "red_cell" | "white_cell" | "platelet">> = {
    "RBC morphology": "red_cell",
    "WBC morphology": "white_cell",
    "Platelet morphology": "platelet",
  };

  const morphologyAreas = weakAreas.filter((area) => lineageByArea[area]);
  const otherAreas = weakAreas.filter((area) => !lineageByArea[area]);

  const usesCaseCandidates = morphologyAreas.length > 0 || otherAreas.includes("Morphology reporting");
  const orgCaseIds = usesCaseCandidates
    ? orgId
      ? new Set((await getPublishedContent("cases", "case", orgId)).map((c) => c.id))
      : null
    : null;

  if (morphologyAreas.length > 0) {
    const { data: attemptedCaseIds } = await supabase
      .from("quiz_attempts")
      .select("case_id")
      .eq("user_id", userId)
      .not("case_id", "is", null);
    const attempted = new Set((attemptedCaseIds ?? []).map((a) => a.case_id));

    // Fetched unfiltered and matched in JS rather than filtering the
    // embedded `features.cell_types.lineage` path server-side — Supabase's
    // embedded-resource filter syntax is finicky to get right against the
    // generated types, and this table is small enough that filtering
    // client-side is simpler and just as fast. Fetched once here (rather
    // than per weak area) since it's the same unfiltered dataset regardless
    // of which lineage we're matching against.
    const { data: candidateCases } = await supabase
      .from("case_features")
      .select("case_id, cases(id, title, status), features(cell_types(lineage))");

    for (const area of morphologyAreas) {
      const lineage = lineageByArea[area]!;
      const match = (candidateCases ?? []).find(
        (c) =>
          c.features?.cell_types?.lineage === lineage &&
          c.cases?.status === "published" &&
          !attempted.has(c.case_id) &&
          (orgCaseIds === null || orgCaseIds.has(c.case_id)),
      );
      if (match?.cases) {
        candidates[area] = {
          kind: "case",
          id: match.cases.id,
          title: match.cases.title,
          href: `/app/cases/${match.cases.id}`,
        };
      }
    }
  }

  // The remaining areas each query a disjoint set of tables, so resolve them
  // concurrently rather than awaiting one area at a time.
  await Promise.all(
    otherAreas.map(async (area) => {
      if (area === "Abnormal cell recognition") {
        const { data: attempted } = await supabase.from("cell_id_attempts").select("exercise_id").eq("user_id", userId);
        const attemptedIds = new Set((attempted ?? []).map((a) => a.exercise_id));
        const { data: exercises } = await supabase
          .from("cell_id_exercises")
          .select("id, title")
          .eq("status", "published");
        const match = (exercises ?? []).find((e) => !attemptedIds.has(e.id));
        if (match) {
          candidates[area] = {
            kind: "exercise",
            exerciseKind: "cell-id",
            id: match.id,
            title: match.title,
            href: `/app/cell-id/${match.id}`,
          };
        }
        return;
      }

      if (area === "Manual differential") {
        const { data: attempted } = await supabase.from("wbc_diff_attempts").select("exercise_id").eq("user_id", userId);
        const attemptedIds = new Set((attempted ?? []).map((a) => a.exercise_id));
        const { data: exercises } = await supabase
          .from("wbc_diff_exercises")
          .select("id, title")
          .eq("status", "published");
        const match = (exercises ?? []).find((e) => !attemptedIds.has(e.id));
        if (match) {
          candidates[area] = {
            kind: "exercise",
            exerciseKind: "wbc-diff",
            id: match.id,
            title: match.title,
            href: `/app/wbc-diff/${match.id}`,
          };
        }
        return;
      }

      if (area === "Morphology reporting") {
        const { data: attempted } = await supabase
          .from("case_report_submissions")
          .select("case_id")
          .eq("user_id", userId);
        const attemptedIds = new Set((attempted ?? []).map((a) => a.case_id));
        const { data: cases } = await supabase.from("cases").select("id, title").eq("status", "published");
        const match = (cases ?? []).find(
          (c) => !attemptedIds.has(c.id) && (orgCaseIds === null || orgCaseIds.has(c.id)),
        );
        if (match) {
          candidates[area] = { kind: "case", id: match.id, title: match.title, href: `/app/cases/${match.id}` };
        }
      }
    }),
  );

  return candidates;
}

async function getDefaultModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string | null,
): Promise<{ moduleId: string; title: string } | null> {
  let moduleIds: string[] | null = null;
  if (orgId) {
    const { data: selections } = await supabase
      .from("org_catalog_selections")
      .select("content_id")
      .eq("org_id", orgId)
      .eq("content_type", "module");
    moduleIds = (selections ?? []).map((s) => s.content_id);
    if (moduleIds.length === 0) return null;
  }

  const query = supabase
    .from("modules")
    .select("id, title")
    .eq("status", "published")
    .eq("module_type", "foundation")
    .order("created_at")
    .limit(1);

  const { data } = await (moduleIds ? query.in("id", moduleIds) : query).maybeSingle();
  return data ? { moduleId: data.id, title: data.title } : null;
}

export async function getStudyRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<StudyRecommendation> {
  const [pathwayModules, competencyRows] = await Promise.all([
    getAssignedPathwayModules(supabase, userId, orgId),
    getCompetencyRows(supabase, userId, orgId),
  ]);

  const weakAreas = competencyRows.filter((r) => r.status !== "Proficient").map((r) => r.area);
  const [competencyCandidates, defaultModule] = await Promise.all([
    getCompetencyCandidates(supabase, userId, orgId, weakAreas),
    getDefaultModule(supabase, orgId),
  ]);

  return pickStudyRecommendation({ pathwayModules, competencyRows, competencyCandidates, defaultModule });
}
