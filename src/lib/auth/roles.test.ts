import { describe, it, expect } from "vitest";
import { defaultRouteForRole, SURFACE_ROLES } from "./roles";

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
