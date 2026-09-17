import { describe, expect, it } from "vitest";
import { pickCertificateProgress } from "./certificate-progress";

describe("pickCertificateProgress", () => {
  it("computes percent complete from modules passed vs. total, and sums CPD points", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Anaemia Fundamentals",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 40, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Anaemia Fundamentals",
      percentComplete: 50,
      completedModules: 2,
      totalModules: 4,
      earnedCpdPoints: 10,
      totalCpdPoints: 20,
    });
  });

  it("sums CPD points by weight, not by module count", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Weighted Curriculum",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 10 },
          { bestScore: 40, passThreshold: 70, cpdPoints: 15 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 3 },
        ],
      },
    ]);

    // Only the 1st and 3rd modules pass (10 + 3 = 13 of 28 total) — if this
    // were counting modules instead of summing points it would be 2/3.
    expect(result?.earnedCpdPoints).toBe(13);
    expect(result?.totalCpdPoints).toBe(28);
    expect(result?.completedModules).toBe(2);
    expect(result?.totalModules).toBe(3);
  });

  it("ignores curricula that don't award a certificate", () => {
    const result = pickCertificateProgress([
      {
        curriculumId: "cur1",
        title: "Practice Track",
        certificateAwarded: false,
        modules: [{ bestScore: 90, passThreshold: 70, cpdPoints: 5 }],
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
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
      {
        curriculumId: "cur2",
        title: "Hand-to-Hand Basics",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: 85, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
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
        modules: [{ bestScore: 90, passThreshold: 70, cpdPoints: 5 }],
      },
      {
        curriculumId: "cur2",
        title: "In Progress",
        certificateAwarded: true,
        modules: [
          { bestScore: 90, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
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
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
          { bestScore: null, passThreshold: 70, cpdPoints: 5 },
        ],
      },
    ]);

    expect(result).toEqual({
      curriculumId: "cur1",
      title: "Not Started Yet",
      percentComplete: 0,
      completedModules: 0,
      totalModules: 2,
      earnedCpdPoints: 0,
      totalCpdPoints: 10,
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
