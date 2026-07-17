export type AppRole =
  | "super_admin"
  | "content_manager"
  | "org_admin"
  | "member";

export type Surface = "/admin" | "/org" | "/app";

/** Which roles may enter each gated surface. Super Admin can always reach any of them. */
export const SURFACE_ROLES: Record<Surface, AppRole[]> = {
  "/admin": ["super_admin", "content_manager"],
  "/org": ["super_admin", "org_admin"],
  "/app": ["super_admin", "content_manager", "org_admin", "member"],
};

/** Where a role lands after login. */
export function defaultRouteForRole(role: AppRole | undefined | null): string {
  switch (role) {
    case "super_admin":
    case "content_manager":
      return "/admin";
    case "org_admin":
      return "/org";
    case "member":
    default:
      return "/app";
  }
}
