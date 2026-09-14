# Learner Dashboard Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/app` (the learner dashboard) to match the cofounder's mockup — a "Continue / Study Next" recommendation card, a static WSI preview card, a "Learning & Certificate Progress" ring, a recent quiz scores list, and quick-access tiles — using only real data the app already tracks, with no invented trend/CPD numbers.

**Architecture:** Two new pure decision-logic modules (`study-recommendation.ts`, `certificate-progress.ts`) each expose a pure, unit-testable "pick" function plus an async Supabase-fetching wrapper — following the same split this codebase already uses (`scoreAnswer` vs `submitQuizAttempt`, `parseQuestionForm` vs the form actions). Three small presentational components render the new cards. `src/app/app/page.tsx` is rewritten to assemble them, reusing the org/pathway/competency queries that already exist elsewhere in the app.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (Postgres + RLS), Vitest for unit tests, Playwright for live end-to-end verification (this repo has no component-testing setup — pure logic gets Vitest unit tests, assembled pages get manual Playwright verification, matching how every other feature in this codebase has been tested).

## Global Constraints

- No new database tables or columns. Everything is computed from data that already exists (`quiz_attempts`, `curricula`/`curriculum_modules`, `case_report_submissions`, `cell_id_attempts`, `wbc_diff_attempts`, `case_features`/`features`/`cell_types`, `slides`).
- No trend deltas ("vs last month") anywhere. Where the mockup showed one, either omit it or use static text like "Last 10 attempts" / "Based on recent activity."
- The WSI preview card on the dashboard is a **static image** (`<img>`, no OpenSeadragon) that links out to the live interactive viewer on the case/module page. Never embed `WsiViewer` on the dashboard.
- Never call it "CPD points" or imply formal CPD accreditation. The progress ring is labeled "Learning & Certificate Progress."
- Follow the existing color/token system from `src/app/globals.css` (`bg-accent`, `text-ink-dim`, etc.) — no new hardcoded colors.
- Run `npx tsc --noEmit`, `npm run lint`, and `npm run test` after every task; all three must be clean before moving to the next task.

---

### Task 1: Study recommendation — pure decision logic

**Files:**
- Create: `src/lib/learner/study-recommendation.ts`
- Test: `src/lib/learner/study-recommendation.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks (this is the first task).
- Produces:
  - `export type StudyRecommendation = { kind: "module"; reason: "pathway" | "default"; id: string; title: string; href: string; context?: string } | { kind: "case"; reason: "competency"; id: string; title: string; href: string; context: string } | { kind: "exercise"; reason: "competency"; exerciseKind: "cell-id" | "wbc-diff"; id: string; title: string; href: string; context: string } | { kind: "none" };`
  - `export type CompetencyArea = "RBC morphology" | "WBC morphology" | "Platelet morphology" | "Abnormal cell recognition" | "Manual differential" | "Morphology reporting";`
  - `export type CompetencyStatus = "Proficient" | "Developing" | "Not yet assessed";`
  - `export function pickStudyRecommendation(input: PickStudyRecommendationInput): StudyRecommendation` — the pure function later tasks' wrapper calls.

This task builds the fallback chain from the spec: **(1)** next incomplete module in the learner's assigned pathway, else **(2)** an activity for the learner's weakest competency area, else **(3)** a default foundation module.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/learner/study-recommendation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickStudyRecommendation } from "./study-recommendation";

describe("pickStudyRecommendation", () => {
  it("recommends the first incomplete module in the assigned pathway", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [
        { moduleId: "m1", title: "Normal RBC Morphology", pathwayTitle: "Foundations", bestScore: 90, passThreshold: 70 },
        { moduleId: "m2", title: "Microcytic Anaemias", pathwayTitle: "Foundations", bestScore: null, passThreshold: 70 },
        { moduleId: "m3", title: "Macrocytic Anaemias", pathwayTitle: "Foundations", bestScore: 40, passThreshold: 70 },
      ],
      competencyRows: [],
      competencyCandidates: {},
      defaultModule: null,
    });

    expect(result).toEqual({
      kind: "module",
      reason: "pathway",
      id: "m2",
      title: "Microcytic Anaemias",
      href: "/app/modules/m2",
      context: "Foundations",
    });
  });

  it("skips a passed module and recommends the next unfinished one", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [
        { moduleId: "m1", title: "Normal RBC Morphology", pathwayTitle: "Foundations", bestScore: 90, passThreshold: 70 },
        { moduleId: "m2", title: "Microcytic Anaemias", pathwayTitle: "Foundations", bestScore: 85, passThreshold: 70 },
      ],
      competencyRows: [{ area: "RBC morphology", status: "Developing" }],
      competencyCandidates: {
        "RBC morphology": { kind: "case", id: "c1", title: "Case: Iron Deficiency", href: "/app/cases/c1" },
      },
      defaultModule: null,
    });

    expect(result).toEqual({
      kind: "case",
      reason: "competency",
      id: "c1",
      title: "Case: Iron Deficiency",
      href: "/app/cases/c1",
      context: "RBC morphology",
    });
  });

  it("falls back to the weakest competency area when no pathway is assigned", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [],
      competencyRows: [
        { area: "RBC morphology", status: "Proficient" },
        { area: "WBC morphology", status: "Not yet assessed" },
        { area: "Platelet morphology", status: "Developing" },
        { area: "Abnormal cell recognition", status: "Proficient" },
        { area: "Manual differential", status: "Proficient" },
        { area: "Morphology reporting", status: "Proficient" },
      ],
      competencyCandidates: {
        "WBC morphology": { kind: "case", id: "c2", title: "Case: Neutrophilia Work-up", href: "/app/cases/c2" },
        "Platelet morphology": { kind: "case", id: "c3", title: "Case: Thrombocytopenia", href: "/app/cases/c3" },
      },
      defaultModule: null,
    });

    // "Not yet assessed" outranks "Developing" as the weaker signal.
    expect(result).toEqual({
      kind: "case",
      reason: "competency",
      id: "c2",
      title: "Case: Neutrophilia Work-up",
      href: "/app/cases/c2",
      context: "WBC morphology",
    });
  });

  it("skips a weak competency area with no available candidate and tries the next weakest", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [],
      competencyRows: [
        { area: "RBC morphology", status: "Not yet assessed" },
        { area: "WBC morphology", status: "Developing" },
      ],
      competencyCandidates: {
        // No candidate for RBC morphology (e.g. no unattempted case exists).
        "WBC morphology": { kind: "case", id: "c2", title: "Case: Neutrophilia Work-up", href: "/app/cases/c2" },
      },
      defaultModule: null,
    });

    expect(result).toEqual({
      kind: "case",
      reason: "competency",
      id: "c2",
      title: "Case: Neutrophilia Work-up",
      href: "/app/cases/c2",
      context: "WBC morphology",
    });
  });

  it("falls back to the default foundation module when there is no other signal", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [],
      competencyRows: [],
      competencyCandidates: {},
      defaultModule: { moduleId: "m0", title: "Introduction to Blood Film Basics" },
    });

    expect(result).toEqual({
      kind: "module",
      reason: "default",
      id: "m0",
      title: "Introduction to Blood Film Basics",
      href: "/app/modules/m0",
    });
  });

  it("returns kind none when there is nothing to recommend at all", () => {
    const result = pickStudyRecommendation({
      pathwayModules: [],
      competencyRows: [],
      competencyCandidates: {},
      defaultModule: null,
    });

    expect(result).toEqual({ kind: "none" });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/learner/study-recommendation.test.ts`
Expected: FAIL — `Cannot find module './study-recommendation'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/learner/study-recommendation.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/learner/study-recommendation.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/learner/study-recommendation.ts src/lib/learner/study-recommendation.test.ts
git commit -m "Add pure study-recommendation decision logic"
```

---

### Task 2: Study recommendation — data-fetching wrapper

**Files:**
- Create: `src/lib/learner/get-study-recommendation.ts`

**Interfaces:**
- Consumes: `pickStudyRecommendation`, `PickStudyRecommendationInput`, `CompetencyArea`, `CompetencyRow`, `CompetencyCandidate`, `StudyRecommendation` from `src/lib/learner/study-recommendation.ts` (Task 1).
- Produces: `export async function getStudyRecommendation(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, orgId: string | null): Promise<StudyRecommendation>` — this is what Task 5 (the dashboard page) calls.

This task is the async half: it fetches the learner's assigned-pathway progress (same computation as `src/app/app/pathways/page.tsx`), the six competency rows (same computation as `src/app/app/competencies/page.tsx`), one unattempted candidate per weak competency area, and the platform's default module — then hands it all to `pickStudyRecommendation`.

There is no unit test for this file: it is a thin Supabase-fetching wrapper with no branching logic of its own (all the branching lives in the pure function from Task 1, already tested), matching how `submitQuizAttempt` wraps `computeAttempt`/`scoreAnswer` elsewhere in this codebase. It is verified in Task 6's live Playwright check instead.

- [ ] **Step 1: Write the implementation**

Create `src/lib/learner/get-study-recommendation.ts`:

```ts
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
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean. If `.eq("features.cell_types.lineage", lineage)` doesn't typecheck against the generated Supabase types for embedded-resource filters, replace it with fetching all `case_features` rows (drop the `.eq` filter) and filtering the `lineage` match in JS instead — the rest of the function is unaffected.

- [ ] **Step 3: Run the full test suite to confirm no regressions**

Run: `npm run test`
Expected: all existing tests plus Task 1's 6 new tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/learner/get-study-recommendation.ts
git commit -m "Add data-fetching wrapper for the study recommendation"
```

---

### Task 3: Certificate progress — pure decision logic + wrapper

**Files:**
- Create: `src/lib/learner/certificate-progress.ts`
- Test: `src/lib/learner/certificate-progress.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `export type CertificateProgress = { curriculumId: string; title: string; percentComplete: number; completedModules: number; totalModules: number };`
  - `export function pickCertificateProgress(curricula: CurriculumForProgress[]): CertificateProgress | null`
  - `export type CurriculumForProgress = { curriculumId: string; title: string; certificateAwarded: boolean; modules: { bestScore: number | null; passThreshold: number }[] };`
  - `export async function getCertificateProgress(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<CertificateProgress | null>` — called by Task 5.

This is the "Learning & Certificate Progress" ring: among curricula that actually award a certificate (`certificate_awarded = true`), show the one closest to completion (ties broken by whichever is first); if the learner hasn't started any certificate-awarding curriculum, `null` (the ring section doesn't render, same as every other "no data yet" section on this dashboard).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/learner/certificate-progress.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { pickCertificateProgress } from "./certificate-progress";

describe("pickCertificateProgress", () => {
  it("computes percent complete from modules passed vs. total", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Anaemia Fundamentals",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70 },
          { bestScore: 40, passThreshold: 70 },
          { bestScore: null, passThreshold: 70 },
          { bestScore: 85, passThreshold: 70 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Anaemia Fundamentals",
      percentComplete: 50,
      completedModules: 2,
      totalModules: 4,
    });
  });

  it("ignores curricula that don't award a certificate", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Practice Track",
        certificateAwarded: false,
        modules: [{ bestScore: 90, passThreshold: 70 }],
      },
    ]);

    expect(result).toBeNull();
  });

  it("picks the certificate-awarding curriculum closest to completion", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Anaemia Fundamentals",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70 },
          { bestScore: null, passThreshold: 70 },
        ],
      },
      {
        curriculumId: "cur2",
        title: "Hand-to-Hand Basics",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70 },
          { bestScore: 85, passThreshold: 70 },
          { bestScore: null, passThreshold: 70 },
        ],
      },
    ]);

    // cur1 is 50% (1/2), cur2 is 67% (2/3) — cur2 is closer to completion.
    expect(result?.curriculumId).toBe("cur2");
  });

  it("skips a fully completed curriculum in favor of one still in progress", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Already Done",
        certificateAwarded: true,
        modules: [{ bestScore: 90, passThreshold: 70 }],
      },
      {
        curriculumId: "cur2",
        title: "In Progress",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70 },
          { bestScore: null, passThreshold: 70 },
        ],
      },
    ]);

    expect(result?.curriculumId).toBe("cur2");
  });

  it("falls back to a 0%-complete certificate curriculum when none are in progress", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Not Started Yet",
        certificateAwarded: true,
        modules: [
          { bestScore: null, passThreshold: 70 },
          { bestScore: null, passThreshold: 70 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Not Started Yet",
      percentComplete: 0,
      completedModules: 0,
      totalModules: 2,
    });
  });

  it("returns null when there is no certificate-awarding curriculum at all", () => {
    expect(pickCertificateProgress([])).toBeNull();
  });

  it("returns null for a certificate curriculum with no modules linked yet", () => {
    const result = pickCertificateProgress([
      { curriculumId: "cur1", title: "Empty", certificateAwarded: true, modules: [] },
    ]);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/learner/certificate-progress.test.ts`
Expected: FAIL — `Cannot find module './certificate-progress'`

- [ ] **Step 3: Write the implementation**

Create `src/lib/learner/certificate-progress.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type CertificateProgress = {
  curriculumId: string;
  title: string;
  percentComplete: number;
  completedModules: number;
  totalModules: number;
};

export type CurriculumForProgress = {
  curriculumId: string;
  title: string;
  certificateAwarded: boolean;
  modules: { bestScore: number | null; passThreshold: number }[];
};

/**
 * Picks which certificate-awarding curriculum to show progress toward on
 * the dashboard: whichever the learner is closest to finishing, so the
 * ring always reflects the certificate nearest in reach. Falls back to an
 * unstarted certificate curriculum (0%) if none are in progress yet, so a
 * brand-new learner still sees what they're working toward.
 */
export function pickCertificateProgress(curricula: CurriculumForProgress[]): CertificateProgress | null {
  const scored = curricula
    .filter((c) => c.certificateAwarded && c.modules.length > 0)
    .map((c) => {
      const completedModules = c.modules.filter((m) => m.bestScore !== null && m.bestScore >= m.passThreshold).length;
      const percentComplete = Math.round((completedModules / c.modules.length) * 100);
      return {
        curriculumId: c.curriculumId,
        title: c.title,
        percentComplete,
        completedModules,
        totalModules: c.modules.length,
      };
    });

  if (scored.length === 0) return null;

  const inProgress = scored.filter((c) => c.percentComplete < 100).sort((a, b) => b.percentComplete - a.percentComplete);
  if (inProgress.length > 0) return inProgress[0];

  return scored[0];
}

export async function getCertificateProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<CertificateProgress | null> {
  const { data: curricula } = await supabase
    .from("curricula")
    .select("id, title, certificate_awarded, pass_threshold")
    .eq("status", "published")
    .eq("certificate_awarded", true);

  if (!curricula || curricula.length === 0) return null;

  const curriculumIds = curricula.map((c) => c.id);
  const { data: links } = await supabase
    .from("curriculum_modules")
    .select("curriculum_id, module_id")
    .in("curriculum_id", curriculumIds);

  const moduleIds = Array.from(new Set((links ?? []).map((l) => l.module_id)));
  const { data: attempts } =
    moduleIds.length > 0
      ? await supabase.from("quiz_attempts").select("module_id, score").eq("user_id", userId).in("module_id", moduleIds)
      : { data: [] };

  const bestByModule = new Map<string, number>();
  for (const a of attempts ?? []) {
    if (!a.module_id) continue;
    bestByModule.set(a.module_id, Math.max(bestByModule.get(a.module_id) ?? 0, a.score));
  }

  const input: CurriculumForProgress[] = curricula.map((c) => ({
    curriculumId: c.id,
    title: c.title,
    certificateAwarded: c.certificate_awarded,
    modules: (links ?? [])
      .filter((l) => l.curriculum_id === c.id)
      .map((l) => ({ bestScore: bestByModule.get(l.module_id) ?? null, passThreshold: c.pass_threshold })),
  }));

  return pickCertificateProgress(input);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/learner/certificate-progress.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Typecheck, lint, full suite**

Run: `npx tsc --noEmit && npm run lint && npm run test`
Expected: all clean

- [ ] **Step 6: Commit**

```bash
git add src/lib/learner/certificate-progress.ts src/lib/learner/certificate-progress.test.ts
git commit -m "Add certificate progress decision logic and data wrapper"
```

---

### Task 4: Presentational dashboard components

**Files:**
- Create: `src/components/dashboard/wsi-preview-card.tsx`
- Create: `src/components/dashboard/certificate-progress-ring.tsx`
- Create: `src/components/dashboard/recent-quiz-scores.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (pure presentational components with their own prop types).
- Produces:
  - `export async function WsiPreviewCard(props: { slideId: string; slideTitle: string; href: string }): Promise<JSX.Element>`
  - `export function CertificateProgressRing(props: { progress: import("@/lib/learner/certificate-progress").CertificateProgress }): JSX.Element`
  - `export function RecentQuizScores(props: { attempts: { id: string; title: string; score: number; passed: boolean; createdAt: string }[] }): JSX.Element`

These three are consumed by Task 5.

- [ ] **Step 1: Create the static WSI preview card**

Create `src/components/dashboard/wsi-preview-card.tsx`:

```tsx
import Link from "next/link";
import { getSlideViewUrl } from "@/lib/slides/get-slide-view-url";

/**
 * A static preview of a slide on the dashboard — just an <img>, no
 * OpenSeadragon — that links out to wherever the full interactive viewer
 * lives (a case or module page). Deliberately not the live WsiViewer: the
 * dashboard should showcase the WSI experience without duplicating the
 * full viewer's functionality.
 */
export async function WsiPreviewCard({
  slideId,
  slideTitle,
  href,
}: {
  slideId: string;
  slideTitle: string;
  href: string;
}) {
  const { url, error } = await getSlideViewUrl(slideId);
  if (error || !url) return null;

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-lg border border-line hover:border-line-strong"
    >
      <div className="flex items-center justify-between border-b border-line bg-surface-sunken px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Whole Slide Viewer</span>
        <span className="text-xs text-accent">Open in viewer &rarr;</span>
      </div>
      <div className="h-40 bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={slideTitle} className="h-full w-full object-cover" />
      </div>
      <p className="px-3 py-2 text-sm font-medium text-ink">{slideTitle}</p>
    </Link>
  );
}
```

- [ ] **Step 2: Create the certificate progress ring**

Create `src/components/dashboard/certificate-progress-ring.tsx`:

```tsx
import type { CertificateProgress } from "@/lib/learner/certificate-progress";

/** A simple SVG ring — no charting library needed for one static value. */
export function CertificateProgressRing({ progress }: { progress: CertificateProgress }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress.percentComplete / 100);

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line p-4">
      <p className="self-start text-xs font-semibold uppercase tracking-wide text-ink-dim">
        Learning &amp; Certificate Progress
      </p>
      <svg width="112" height="112" viewBox="0 0 96 96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="text-center">
        <p className="text-2xl font-semibold text-ink">{progress.percentComplete}%</p>
        <p className="text-xs text-ink-dim">
          {progress.completedModules} / {progress.totalModules} modules &middot; {progress.title}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the recent quiz scores list**

Create `src/components/dashboard/recent-quiz-scores.tsx`:

```tsx
export function RecentQuizScores({
  attempts,
}: {
  attempts: { id: string; title: string; score: number; passed: boolean; createdAt: string }[];
}) {
  return (
    <div className="rounded-lg border border-line p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Recent Quiz Scores</p>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {attempts.map((a) => (
          <div key={a.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{a.title}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  a.passed ? "bg-success-soft text-success-soft-ink" : "bg-danger-soft text-danger-soft-ink"
                }`}
              >
                {a.score}% &middot; {a.passed ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={`h-full rounded-full ${a.passed ? "bg-success" : "bg-danger"}`}
                style={{ width: `${a.score}%` }}
              />
            </div>
          </div>
        ))}
        {attempts.length === 0 && <p className="text-sm text-ink-faint">No quiz attempts yet.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/wsi-preview-card.tsx src/components/dashboard/certificate-progress-ring.tsx src/components/dashboard/recent-quiz-scores.tsx
git commit -m "Add presentational dashboard components"
```

---

### Task 5: Assemble the new dashboard

**Files:**
- Modify: `src/app/app/page.tsx` (entire file — see below for the full replacement)

**Interfaces:**
- Consumes: `getStudyRecommendation` (Task 2), `getCertificateProgress` (Task 3), `WsiPreviewCard`, `CertificateProgressRing`, `RecentQuizScores` (Task 4).
- Produces: nothing further — this is the last task in this plan.

- [ ] **Step 1: Replace the dashboard page**

Replace the entire contents of `src/app/app/page.tsx`:

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { getActiveImpersonation, getEffectiveUserId } from "@/lib/auth/impersonation";
import { getLearnerOrgId } from "@/lib/learner/get-learner-org";
import { getPublishedContent } from "@/lib/learner/published-content";
import { getStudyRecommendation } from "@/lib/learner/get-study-recommendation";
import { getCertificateProgress } from "@/lib/learner/certificate-progress";
import { WsiPreviewCard } from "@/components/dashboard/wsi-preview-card";
import { CertificateProgressRing } from "@/components/dashboard/certificate-progress-ring";
import { RecentQuizScores } from "@/components/dashboard/recent-quiz-scores";

const QUICK_LINKS = [
  { label: "Modules", href: "/app/modules", blurb: "Structured learning content" },
  { label: "Case Studies", href: "/app/cases", blurb: "Apply skills to real scenarios" },
  { label: "Manual Diff Counter", href: "/app/wbc-diff", blurb: "Practice cell classification" },
  { label: "Library", href: "/app/library", blurb: "Browse the slide collection" },
];

export default async function LearnerHome() {
  const supabase = await createClient();
  const profile = await getCurrentProfile();
  const impersonation = await getActiveImpersonation();
  const userId = await getEffectiveUserId();
  const displayName = impersonation
    ? impersonation.target.fullName || impersonation.target.email
    : profile?.fullName || profile?.email;
  const orgId = await getLearnerOrgId();

  const [modules, cases, slideViewsResult, certificatesResult, recommendation, certificateProgress, recentAttempts] =
    await Promise.all([
      getPublishedContent("modules", "module", orgId),
      getPublishedContent("cases", "case", orgId),
      supabase.from("slide_views").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      supabase.from("certificates").select("id", { count: "exact", head: true }).eq("user_id", userId!),
      getStudyRecommendation(supabase, userId!, orgId),
      getCertificateProgress(supabase, userId!),
      supabase
        .from("quiz_attempts")
        .select("id, score, passed, created_at, module_id, case_id, modules(title), cases(title)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const stats = [
    { label: "Modules available", value: modules.length },
    { label: "Case studies available", value: cases.length },
    { label: "Slides reviewed", value: slideViewsResult.count ?? 0 },
    { label: "Certificates earned", value: certificatesResult.count ?? 0 },
  ];

  const quizScores = (recentAttempts.data ?? []).map((a) => ({
    id: a.id,
    title: a.modules?.title ?? a.cases?.title ?? "Untitled",
    score: a.score,
    passed: a.passed,
    createdAt: a.created_at,
  }));

  // The recommendation's slide comes from whichever module/case it points
  // at, so the WSI preview always matches "what to study next."
  let previewSlide: { slideId: string; title: string } | null = null;
  if (recommendation.kind === "module") {
    const { data } = await supabase
      .from("lessons")
      .select("slide_id, title")
      .eq("module_id", recommendation.id)
      .not("slide_id", "is", null)
      .order("position")
      .limit(1)
      .maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  } else if (recommendation.kind === "case") {
    const { data } = await supabase.from("cases").select("slide_id").eq("id", recommendation.id).maybeSingle();
    if (data?.slide_id) previewSlide = { slideId: data.slide_id, title: recommendation.title };
  }

  return (
    <div>
      <h1 className="text-xl font-semibold">Welcome, {displayName}</h1>
      <p className="mt-2 max-w-xl text-sm text-ink-dim">
        {orgId ? "Here's what your organization has assigned." : "Here's what's available to study."}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-line p-4">
            <p className="text-xs uppercase text-ink-faint">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {recommendation.kind !== "none" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">
              {recommendation.reason === "pathway" ? "Continue Learning" : "Study Next"}
            </p>
            <p className="mt-2 text-lg font-medium text-ink">{recommendation.title}</p>
            {"context" in recommendation && recommendation.context && (
              <p className="mt-1 text-sm text-ink-dim">{recommendation.context}</p>
            )}
            <Link
              href={recommendation.href}
              className="mt-4 inline-block rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink"
            >
              {recommendation.kind === "module" ? "Continue module" : "Start now"} &rarr;
            </Link>
          </div>
          {previewSlide && (
            <WsiPreviewCard slideId={previewSlide.slideId} slideTitle={previewSlide.title} href={recommendation.href} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {certificateProgress && (
          <div className="lg:col-span-1">
            <CertificateProgressRing progress={certificateProgress} />
          </div>
        )}
        <div className={certificateProgress ? "lg:col-span-2" : "lg:col-span-3"}>
          <RecentQuizScores attempts={quizScores} />
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wider text-ink-faint">Quick access</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="rounded-lg border border-line p-4 hover:border-line-strong">
            <p className="font-medium text-ink">{link.label}</p>
            <p className="mt-1 text-sm text-ink-dim">{link.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: both clean — `src/lib/org/get-org-progress.ts` already does the identical `.select("...", "modules(title)")` embedded-join pattern against the generated Supabase types with no extra casting, so this query needs none either.

- [ ] **Step 3: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (18 existing + 13 new from Tasks 1 and 3)

- [ ] **Step 4: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "Rebuild the learner dashboard with recommendation, WSI preview, and progress ring"
```

---

### Task 6: Live verification

**Files:** none (verification only, no code changes)

- [ ] **Step 1: Start the dev server against the real Supabase project**

Create `.env.local` (see any earlier session's pattern: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `mcp__Supabase__get_project_url` / `get_publishable_keys`), then run `npm run dev`.

- [ ] **Step 2: Log in as `demo.learner@optymumss.com` and load `/app`**

Confirm:
- The stat tiles render with real counts, no "vs last month" text anywhere.
- A "Continue Learning" or "Study Next" card renders with a real module/case/exercise title and a working link.
- If that recommendation's module/case has a slide, a static WSI preview image renders below/beside it (an `<img>`, not an interactive viewer) and clicking it navigates to the real case/module page where the full `WsiViewer` still works.
- If the learner has any certificate-awarding curriculum with progress, the "Learning & Certificate Progress" ring renders with a plausible percentage; if not, the ring section is simply absent (no error, no "0%" for a nonexistent curriculum).
- "Recent Quiz Scores" lists up to 5 real past attempts with correct pass/fail coloring, or "No quiz attempts yet."
- Quick access tiles link to real, working pages.

- [ ] **Step 3: Test the fallback chain by varying the demo learner's data**

Using `mcp__Supabase__execute_sql`, temporarily check: does `demo.learner@optymumss.com` belong to an org with an assigned pathway (`org_catalog_selections` with `content_type = 'curriculum'`)? If so, confirm the recommendation is a pathway module (reason `"pathway"`). If you want to see the competency-fallback path, query for a learner/org combination without an assigned pathway (or temporarily check what a self-directed demo account like a fresh signup would see) and confirm the recommendation instead comes from a weak competency area.

- [ ] **Step 4: Confirm no regressions on other pages**

Visit `/app/pathways`, `/app/competencies`, `/app/certificates`, and a case/module detail page. Confirm they render exactly as before — this plan only touches `/app` (the dashboard) and adds new files; it doesn't modify any of those other pages.

- [ ] **Step 5: Stop the dev server and remove `.env.local`**

```bash
pkill -f "next dev"
rm -f .env.local
```

---

## Explicitly out of scope for this plan

- The organization dashboard and admin dashboard rebuilds (separate plans, in that priority order, once this one ships).
- Any new database table or column — if live verification in Task 6 reveals a gap this plan's queries can't fill from existing data, stop and report back rather than improvising a schema change.
- Trend/delta tracking of any kind.
- Embedding the live `WsiViewer` anywhere on the dashboard.
