import { describe, it, expect } from "vitest";
import { defaultRouteForRole, SURFACE_ROLES, ROLE_LABELS, type AppRole } from "./roles";

describe("defaultRouteForRole", () => {
  it("sends super_admin and content_manager to /admin", () => {
    expect(defaultRouteForRole("super_admin")).toBe("/admin");
    expect(defaultRouteForRole("content_manager")).toBe("/admin");
  });

  it("sends org_admin to /org", () => {
    expect(defaultRouteForRole("org_admin")).toBe("/org");
  });

  it("sends member, and any unset role, to /app", () => {
    expect(defaultRouteForRole("member")).toBe("/app");
    expect(defaultRouteForRole(null)).toBe("/app");
    expect(defaultRouteForRole(undefined)).toBe("/app");
  });
});

describe("SURFACE_ROLES", () => {
  it("lets super_admin reach every gated surface", () => {
    for (const roles of Object.values(SURFACE_ROLES)) {
      expect(roles).toContain("super_admin");
    }
  });

  it("keeps member out of /admin and /org", () => {
    expect(SURFACE_ROLES["/admin"]).not.toContain("member");
    expect(SURFACE_ROLES["/org"]).not.toContain("member");
    expect(SURFACE_ROLES["/app"]).toContain("member");
  });
});

describe("ROLE_LABELS", () => {
  it("has a human-readable label for every role", () => {
    const roles: AppRole[] = ["super_admin", "content_manager", "org_admin", "member"];
    for (const role of roles) {
      expect(ROLE_LABELS[role]).toEqual(expect.any(String));
      expect(ROLE_LABELS[role].length).toBeGreaterThan(0);
    }
  });

  it("labels don't leak the raw snake_case role value", () => {
    expect(ROLE_LABELS.super_admin).not.toContain("_");
    expect(ROLE_LABELS.content_manager).not.toContain("_");
    expect(ROLE_LABELS.org_admin).not.toContain("_");
  });
});
