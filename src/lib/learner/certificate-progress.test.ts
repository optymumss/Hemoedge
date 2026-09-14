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
