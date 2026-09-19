import { describe, it, expect } from "vitest";
import { summarizePlatformOrgs, type PlatformOrgRow } from "./get-platform-summary";

const now = new Date(Date.UTC(2026, 8, 19, 12, 0, 0)); // 2026-09-19 12:00 UTC

function makeRow(overrides: Partial<PlatformOrgRow> & { org_id: string }): PlatformOrgRow {
  return {
    org_id: overrides.org_id,
    name: overrides.name ?? `Org ${overrides.org_id}`,
    seats: overrides.seats ?? null,
    status: overrides.status ?? "active",
    created_at: overrides.created_at ?? new Date(Date.UTC(2026, 0, 1)).toISOString(),
    member_count: overrides.member_count ?? 0,
  };
}

describe("summarizePlatformOrgs", () => {
  it("counts total, active, and suspended organizations", () => {
    const rows = [
      makeRow({ org_id: "a", status: "active" }),
      makeRow({ org_id: "b", status: "active" }),
      makeRow({ org_id: "c", status: "suspended" }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.totalOrgs).toBe(3);
    expect(result.activeOrgs).toBe(2);
    expect(result.suspendedOrgs).toBe(1);
  });

  it("sums member_count across all orgs for totalLearners", () => {
    const rows = [makeRow({ org_id: "a", member_count: 5 }), makeRow({ org_id: "b", member_count: 12 })];
    expect(summarizePlatformOrgs(rows, now).totalLearners).toBe(17);
  });

  it("counts an org created exactly 30 days ago as within the window (inclusive lower edge)", () => {
    const exactlyThirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const rows = [makeRow({ org_id: "a", created_at: exactlyThirtyDaysAgo.toISOString() })];
    expect(summarizePlatformOrgs(rows, now).newLast30Days).toBe(1);
  });

  it("excludes an org created 31 days ago from newLast30Days", () => {
    const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
    const rows = [makeRow({ org_id: "a", created_at: thirtyOneDaysAgo.toISOString() })];
    expect(summarizePlatformOrgs(rows, now).newLast30Days).toBe(0);
  });

  it("excludes orgs with unlimited (null) seats from near-seat-limit, regardless of member count", () => {
    const rows = [makeRow({ org_id: "a", seats: null, member_count: 10000 })];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(0);
    expect(result.nearSeatLimit).toEqual([]);
  });

  it("includes an org at exactly 90% utilization (inclusive threshold)", () => {
    const rows = [makeRow({ org_id: "a", seats: 10, member_count: 9 })];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(1);
    expect(result.nearSeatLimit[0].utilizationPercent).toBe(90);
  });

  it("excludes an org at 89% utilization", () => {
    const rows = [makeRow({ org_id: "a", seats: 100, member_count: 89 })];
    expect(summarizePlatformOrgs(rows, now).nearSeatLimitCount).toBe(0);
  });

  it("reports the full near-seat-limit count even when more than 5 orgs qualify, while the list stays capped at 5", () => {
    const rows = Array.from({ length: 7 }, (_, i) => makeRow({ org_id: `org-${i}`, seats: 10, member_count: 10 }));
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimitCount).toBe(7);
    expect(result.nearSeatLimit).toHaveLength(5);
  });

  it("sorts near-seat-limit orgs by utilization descending", () => {
    const rows = [
      makeRow({ org_id: "a", name: "Lower", seats: 10, member_count: 9 }),
      makeRow({ org_id: "b", name: "Higher", seats: 10, member_count: 10 }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.nearSeatLimit.map((o) => o.name)).toEqual(["Higher", "Lower"]);
  });

  it("returns recentlyCreated sorted newest-first, independent of the 30-day window", () => {
    const rows = [
      makeRow({ org_id: "a", name: "Old", created_at: new Date(Date.UTC(2020, 0, 1)).toISOString() }),
      makeRow({ org_id: "b", name: "New", created_at: new Date(Date.UTC(2026, 8, 18)).toISOString() }),
    ];
    const result = summarizePlatformOrgs(rows, now);
    expect(result.recentlyCreated.map((o) => o.name)).toEqual(["New", "Old"]);
  });

  it("returns fewer than 5 recentlyCreated entries when fewer than 5 orgs exist, without padding", () => {
    const rows = [makeRow({ org_id: "a" }), makeRow({ org_id: "b" })];
    expect(summarizePlatformOrgs(rows, now).recentlyCreated).toHaveLength(2);
  });

  it("returns a fully zeroed/empty summary for zero organizations", () => {
    const result = summarizePlatformOrgs([], now);
    expect(result.totalOrgs).toBe(0);
    expect(result.totalLearners).toBe(0);
    expect(result.nearSeatLimitCount).toBe(0);
    expect(result.nearSeatLimit).toEqual([]);
    expect(result.recentlyCreated).toEqual([]);
  });
});
