import { Resend } from "resend";

let client: Resend | null = null;

/** Returns null when RESEND_API_KEY isn't set, so callers can skip sending. */
export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;

  if (!client) {
    client = new Resend(key);
  }
  return client;
}
