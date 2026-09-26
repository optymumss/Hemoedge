/**
 * Container.start() waits for the instance to come up and throws if it has
 * already exited by the first health probe -- which happens when
 * run-tiling.sh fails (or finishes) within about a second. By then the
 * script has already reported its outcome through the callback route (ready
 * on exit 0, failed via its ERR trap otherwise), so that is not a start
 * failure. Anything else means the container never ran and nobody will call
 * back, so the caller must be told.
 */
export function containerAlreadyExited(err: unknown): boolean {
  if (err === undefined) return true;
  const message = err instanceof Error ? err.message : "";
  return /exited\b.*\bexit code/i.test(message);
}
