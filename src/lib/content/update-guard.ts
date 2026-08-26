/**
 * A content manager can only edit their own draft/changes_requested content
 * (see the "%1$s: content manager can edit their own draft or bounced work"
 * RLS policy) — editing something already submitted for review or published
 * isn't a Postgres error, it's a normal `.update()` that matches zero rows.
 * Chaining `.select("id").single()` after the update turns that silent
 * no-op into a PGRST116 ("no rows returned") we can catch here and turn
 * into a message, instead of the save appearing to succeed while nothing
 * actually changed.
 */
export function updateGuardMessage(error: { code?: string } | null): string | null {
  if (error?.code === "PGRST116") {
    return "This can no longer be edited — it's already been submitted for review.";
  }
  return null;
}
