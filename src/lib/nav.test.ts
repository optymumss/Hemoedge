import { describe, it, expect } from "vitest";
import { visibleFor, adminNav } from "./nav";

describe("visibleFor", () => {
  it("hides role-restricted items from a role that isn't listed", () => {
    const sections = visibleFor(adminNav, "content_manager");
    const platform = sections.find((s) => s.section === "Platform");
    expect(platform?.items.map((i) => i.label)).not.toContain("Tiers");
    expect(platform?.items.map((i) => i.label)).toContain("Dashboard");
  });

  it("shows role-restricted items to a role that is listed", () => {
    const sections = visibleFor(adminNav, "super_admin");
    const platform = sections.find((s) => s.section === "Platform");
    expect(platform?.items.map((i) => i.label)).toContain("Tiers");
    expect(platform?.items.map((i) => i.label)).toContain("Audit Log");
  });

  it("drops a section entirely once every item in it is filtered out", () => {
    const nav = [
      { section: "Staff only", items: [{ label: "X", href: "/x", roles: ["super_admin" as const] }] },
    ];
    expect(visibleFor(nav, "member")).toEqual([]);
  });

  it("keeps items with no roles restriction visible to every role", () => {
    const sections = visibleFor(adminNav, "member");
    const library = sections.find((s) => s.section === "Library Management");
    expect(library?.items.map((i) => i.label)).toContain("Slides");
  });
});
