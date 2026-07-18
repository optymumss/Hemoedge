import { getResendClient } from "./client";

const FROM = process.env.EMAIL_FROM || "HemoEdge <notifications@hemoedge.com>";

/**
 * Best-effort transactional email — a notification failing (or
 * RESEND_API_KEY being unset) should never block the action that
 * triggered it, so this never throws.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const client = getResendClient();
  if (!client) return;

  try {
    await client.emails.send({ from: FROM, to, subject, html });
  } catch {
    // Swallow — see doc comment above.
  }
}
