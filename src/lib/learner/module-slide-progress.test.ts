import { describe, it, expect } from "vitest";
import { computeSlideProgress } from "./module-slide-progress";

describe("computeSlideProgress", () => {
  it("counts how many of the module's slides have been viewed", () => {
    const result = computeSlideProgress(["a", "b", "c", "d", "e", "f"], new Set(["a", "c"]));
    expect(result).toEqual({ completed: 2, total: 6, percent: 33 });
  });

  it("is 100% when every slide has been viewed", () => {
    const result = computeSlideProgress(["a", "b"], new Set(["a", "b"]));
    expect(result).toEqual({ completed: 2, total: 2, percent: 100 });
  });

  it("is 0% when no slides have been viewed", () => {
    const result = computeSlideProgress(["a", "b"], new Set());
    expect(result).toEqual({ completed: 0, total: 2, percent: 0 });
  });

  it("ignores viewed slide ids that aren't part of this module", () => {
    const result = computeSlideProgress(["a", "b"], new Set(["a", "z"]));
    expect(result).toEqual({ completed: 1, total: 2, percent: 50 });
  });

  it("is 0% (not NaN) for a module with no slides", () => {
    const result = computeSlideProgress([], new Set());
    expect(result).toEqual({ completed: 0, total: 0, percent: 0 });
  });
});
