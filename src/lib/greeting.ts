/**
 * Time-based greeting shown in the app header, e.g. "Good afternoon, Subra".
 * Boundaries: before 12:00 is morning, 12:00-16:59 is afternoon, 17:00+ is evening.
 */
export function getGreeting(date: Date, name: string): string {
  const hour = date.getHours();
  const timeOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  return `Good ${timeOfDay}, ${name}`;
}

/**
 * Extracts a first name from a full name for the greeting. Falls back to
 * the whole (trimmed) string when there's no whitespace to split on, so a
 * bare email still renders sensibly.
 */
export function firstName(identity: string): string {
  const trimmed = identity.trim();
  const spaceIndex = trimmed.indexOf(" ");
  return spaceIndex === -1 ? trimmed : trimmed.slice(0, spaceIndex);
}
