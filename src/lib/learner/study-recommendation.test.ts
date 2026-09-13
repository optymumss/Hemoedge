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
