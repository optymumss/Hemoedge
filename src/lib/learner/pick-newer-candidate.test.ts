import { describe, it, expect } from "vitest";
import { pickNewerCandidate, type FallbackCandidate } from "./pick-newer-candidate";

const make = (createdAt: string): FallbackCandidate => ({
  slideId: "slide-1",
  title: "Some title",
  href: "/app/cases/1",
  createdAt,
});

describe("pickNewerCandidate", () => {
  it("returns null when both are null", () => {
    expect(pickNewerCandidate(null, null)).toBeNull();
  });

  it("returns a when only a is non-null", () => {
    const a = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(a, null)).toBe(a);
  });

  it("returns b when only b is non-null", () => {
    const b = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(null, b)).toBe(b);
  });

  it("returns a when a is newer than b", () => {
    const a = make("2026-06-01T00:00:00Z");
    const b = make("2026-01-01T00:00:00Z");
    expect(pickNewerCandidate(a, b)).toBe(a);
  });

  it("returns b when b is newer than a", () => {
    const a = make("2026-01-01T00:00:00Z");
    const b = make("2026-06-01T00:00:00Z");
    expect(pickNewerCandidate(a, b)).toBe(b);
  });
});
