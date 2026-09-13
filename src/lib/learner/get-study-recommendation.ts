import { createClient } from "@/lib/supabase/server";
import {
  pickStudyRecommendation,
  type CompetencyArea,
  type CompetencyCandidate,
  type CompetencyRow,
  type PathwayModule,
  type StudyRecommendation,
} from "./study-recommendation";

const PROFICIENT_THRESHOLD = 70;

function statusFromScores(scores: number[]): "Proficient" | "Developing" | "Not yet assessed" {
  if (scores.length === 0) return "Not yet assessed";
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  return avg >= PROFICIENT_THRESHOLD ? "Proficient" : "Developing";
}

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

async function getCompetencyRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CompetencyRow[]> {
  const { data: caseFeatureLinks } = await supabase
    .from("case_features")
    .select("case_id, features(cell_type_id, cell_types(lineage))");
  const { data: quizAttempts } = await supabase.from("quiz_attempts").select("case_id, score").eq("user_id", userId);
  const { data: wbcAttempts } = await supabase
    .from("wbc_diff_attempts")
    .select("accuracy_pct")
    .eq("user_id", userId);
  const { data: cellIdAttempts } = await supabase
    .from("cell_id_attempts")
    .select("accuracy_pct")
    .eq("user_id", userId);
  const { data: reportSubmissions } = await supabase
    .from("case_report_submissions")
    .select("ai_score")
    .eq("user_id", userId);

  const bestByCase = new Map<string, number>();
  for (const a of quizAttempts ?? []) {
    if (!a.case_id) continue;
    bestByCase.set(a.case_id, Math.max(bestByCase.get(a.case_id) ?? 0, a.score));
  }

  const caseIdsByLineage: Record<"red_cell" | "white_cell" | "platelet", Set<string>> = {
    red_cell: new Set(),
    white_cell: new Set(),
    platelet: new Set(),
  };
  for (const link of caseFeatureLinks ?? []) {
    const lineage = link.features?.cell_types?.lineage;
    if (lineage === "red_cell" || lineage === "white_cell" || lineage === "platelet") {
      caseIdsByLineage[lineage].add(link.case_id);
    }
  }
  function scoresForLineage(lineage: "red_cell" | "white_cell" | "platelet"): number[] {
    return Array.from(caseIdsByLineage[lineage])
      .map((id) => bestByCase.get(id))
      .filter((s): s is number => s !== undefined);
  }

  return [
    { area: "RBC morphology", status: statusFromScores(scoresForLineage("red_cell")) },
    { area: "WBC morphology", status: statusFromScores(scoresForLineage("white_cell")) },
    { area: "Platelet morphology", status: statusFromScores(scoresForLineage("platelet")) },
    {
      area: "Abnormal cell recognition",
      status: statusFromScores((cellIdAttempts ?? []).map((a) => Number(a.accuracy_pct))),
    },
    {
      area: "Manual differential",
      status: statusFromScores((wbcAttempts ?? []).map((a) => Number(a.accuracy_pct))),
    },
    {
      area: "Morphology reporting",
      status: statusFromScores((reportSubmissions ?? []).map((s) => s.ai_score)),
    },
  ];
}

async function getCompetencyCandidates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  weakAreas: CompetencyArea[],
): Promise<Partial<Record<CompetencyArea, CompetencyCandidate>>> {
  const candidates: Partial<Record<CompetencyArea, CompetencyCandidate>> = {};

  const lineageByArea: Partial<Record<CompetencyArea, "red_cell" | "white_cell" | "platelet">> = {
    "RBC morphology": "red_cell",
    "WBC morphology": "white_cell",
    "Platelet morphology": "platelet",
  };

  for (const area of weakAreas) {
    const lineage = lineageByArea[area];
    if (lineage) {
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
      // client-side is simpler and just as fast.
      const { data: candidateCases } = await supabase
        .from("case_features")
        .select("case_id, cases(id, title, status), features(cell_types(lineage))");

      const match = (candidateCases ?? []).find(
        (c) =>
          c.features?.cell_types?.lineage === lineage &&
          c.cases?.status === "published" &&
          !attempted.has(c.case_id),
      );
      if (match?.cases) {
        candidates[area] = {
          kind: "case",
          id: match.cases.id,
          title: match.cases.title,
          href: `/app/cases/${match.cases.id}`,
        };
      }
      continue;
    }

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
      continue;
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
      continue;
    }

    if (area === "Morphology reporting") {
      const { data: attempted } = await supabase
        .from("case_report_submissions")
        .select("case_id")
        .eq("user_id", userId);
      const attemptedIds = new Set((attempted ?? []).map((a) => a.case_id));
      const { data: cases } = await supabase.from("cases").select("id, title").eq("status", "published");
      const match = (cases ?? []).find((c) => !attemptedIds.has(c.id));
      if (match) {
        candidates[area] = { kind: "case", id: match.id, title: match.title, href: `/app/cases/${match.id}` };
      }
    }
  }

  return candidates;
}

async function getDefaultModule(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ moduleId: string; title: string } | null> {
  const { data } = await supabase
    .from("modules")
    .select("id, title")
    .eq("status", "published")
    .eq("module_type", "foundation")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data ? { moduleId: data.id, title: data.title } : null;
}

export async function getStudyRecommendation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  orgId: string | null,
): Promise<StudyRecommendation> {
  const [pathwayModules, competencyRows] = await Promise.all([
    getAssignedPathwayModules(supabase, userId, orgId),
    getCompetencyRows(supabase, userId),
  ]);

  const weakAreas = competencyRows.filter((r) => r.status !== "Proficient").map((r) => r.area);
  const [competencyCandidates, defaultModule] = await Promise.all([
    getCompetencyCandidates(supabase, userId, weakAreas),
    getDefaultModule(supabase),
  ]);

  return pickStudyRecommendation({ pathwayModules, competencyRows, competencyCandidates, defaultModule });
}
