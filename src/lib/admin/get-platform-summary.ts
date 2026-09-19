const SEAT_LIMIT_THRESHOLD = 0.9;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export type PlatformOrgRow = {
  org_id: string;
  name: string;
  seats: number | null;
  status: string;
  created_at: string;
  member_count: number;
};

export type PlatformOrgSummary = {
  totalOrgs: number;
  activeOrgs: number;
  suspendedOrgs: number;
  totalLearners: number;
  newLast30Days: number;
  nearSeatLimitCount: number;
  nearSeatLimit: { orgId: string; name: string; memberCount: number; seats: number; utilizationPercent: number }[];
  recentlyCreated: { orgId: string; name: string; createdAt: string }[];
};

export function summarizePlatformOrgs(rows: PlatformOrgRow[], now: Date): PlatformOrgSummary {
  const totalOrgs = rows.length;
  const activeOrgs = rows.filter((r) => r.status === "active").length;
  const suspendedOrgs = rows.filter((r) => r.status === "suspended").length;
  const totalLearners = rows.reduce((sum, r) => sum + r.member_count, 0);

  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);
  const newLast30Days = rows.filter((r) => new Date(r.created_at) >= thirtyDaysAgo).length;

  const nearLimitAll = rows
    .filter((r) => r.seats !== null && r.seats > 0 && r.member_count / r.seats >= SEAT_LIMIT_THRESHOLD)
    .map((r) => ({
      orgId: r.org_id,
      name: r.name,
      memberCount: r.member_count,
      seats: r.seats as number,
      utilizationPercent: Math.round((r.member_count / (r.seats as number)) * 100),
    }))
    .sort((a, b) => b.utilizationPercent - a.utilizationPercent);

  const recentlyCreated = [...rows]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)
    .map((r) => ({ orgId: r.org_id, name: r.name, createdAt: r.created_at }));

  return {
    totalOrgs,
    activeOrgs,
    suspendedOrgs,
    totalLearners,
    newLast30Days,
    nearSeatLimitCount: nearLimitAll.length,
    nearSeatLimit: nearLimitAll.slice(0, 5),
    recentlyCreated,
  };
}
