export type CompetencyArea =
  | "RBC morphology"
  | "WBC morphology"
  | "Platelet morphology"
  | "Abnormal cell recognition"
  | "Manual differential"
  | "Morphology reporting";

export type CompetencyStatus = "Proficient" | "Developing" | "Not yet assessed";

export type StudyRecommendation =
  | {
      kind: "module";
      reason: "pathway" | "default";
      id: string;
      title: string;
      href: string;
      context?: string;
    }
  | {
      kind: "case";
      reason: "competency";
      id: string;
      title: string;
      href: string;
      context: string;
    }
  | {
      kind: "exercise";
      reason: "competency";
      exerciseKind: "cell-id" | "wbc-diff";
      id: string;
      title: string;
      href: string;
      context: string;
    }
  | { kind: "none" };

export type PathwayModule = {
  moduleId: string;
  title: string;
  pathwayTitle: string;
  bestScore: number | null;
  passThreshold: number;
};

export type CompetencyRow = { area: CompetencyArea; status: CompetencyStatus };

export type CompetencyCandidate =
  | { kind: "case"; id: string; title: string; href: string }
  | { kind: "exercise"; exerciseKind: "cell-id" | "wbc-diff"; id: string; title: string; href: string };

export type PickStudyRecommendationInput = {
  /** Modules in the learner's assigned pathway, in the order they should be
   * studied. Empty when self-directed (no org-assigned pathway). */
  pathwayModules: PathwayModule[];
  /** The six Competencies-page rows, in display order. */
  competencyRows: CompetencyRow[];
  /** One pre-resolved, not-yet-attempted piece of content per competency
   * area, when one exists. Resolving "does unattempted content exist" is
   * the caller's job (it needs a DB round trip); this function only picks
   * which area to recommend. */
  competencyCandidates: Partial<Record<CompetencyArea, CompetencyCandidate>>;
  /** The platform's default starter module, shown when there's no pathway
   * and no competency signal at all (e.g. a brand-new learner). */
  defaultModule: { moduleId: string; title: string } | null;
};

/** Lower rank = weaker (more worth recommending). "Not yet assessed" ranks
 * below "Developing" — no evidence of skill is a stronger signal to study
 * than partial evidence of struggling. */
const STATUS_WEAKNESS_RANK: Record<CompetencyStatus, number> = {
  "Not yet assessed": 0,
  Developing: 1,
  Proficient: 2,
};

/**
 * Picks what a learner should study next, in priority order:
 * 1. The next incomplete module in their assigned Learning Pathway.
 * 2. An activity targeting their weakest competency area.
 * 3. A default foundation module, if nothing else applies.
 */
export function pickStudyRecommendation(input: PickStudyRecommendationInput): StudyRecommendation {
  const nextPathwayModule = input.pathwayModules.find(
    (m) => m.bestScore === null || m.bestScore < m.passThreshold,
  );
  if (nextPathwayModule) {
    return {
      kind: "module",
      reason: "pathway",
      id: nextPathwayModule.moduleId,
      title: nextPathwayModule.title,
      href: `/app/modules/${nextPathwayModule.moduleId}`,
      context: nextPathwayModule.pathwayTitle,
    };
  }

  const weakestFirst = [...input.competencyRows]
    .filter((row) => row.status !== "Proficient")
    .sort((a, b) => STATUS_WEAKNESS_RANK[a.status] - STATUS_WEAKNESS_RANK[b.status]);

  for (const row of weakestFirst) {
    const candidate = input.competencyCandidates[row.area];
    if (!candidate) continue;
    if (candidate.kind === "case") {
      return {
        kind: "case",
        reason: "competency",
        id: candidate.id,
        title: candidate.title,
        href: candidate.href,
        context: row.area,
      };
    }
    return {
      kind: "exercise",
      reason: "competency",
      exerciseKind: candidate.exerciseKind,
      id: candidate.id,
      title: candidate.title,
      href: candidate.href,
      context: row.area,
    };
  }

  if (input.defaultModule) {
    return {
      kind: "module",
      reason: "default",
      id: input.defaultModule.moduleId,
      title: input.defaultModule.title,
      href: `/app/modules/${input.defaultModule.moduleId}`,
    };
  }

  return { kind: "none" };
}
