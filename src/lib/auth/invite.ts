import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { accountInviteEmail } from "@/lib/email/templates";
import type { AppRole } from "./roles";

export type InviteResult = { error?: string; userId?: string };

/**
 * Creates the Supabase auth user (and, via the on_auth_user_created
 * trigger, its profile row) immediately, rather than requiring the
 * invitee to have already self-signed-up. Emails them a link through the
 * existing Resend integration instead of Supabase's own invite email, so
 * it matches the rest of the app's transactional email styling.
 *
 * The link points at our own /auth/confirm with a server-verifiable
 * token_hash, rather than Supabase's hosted verify redirect — avoiding
 * any dependence on this project's Auth email-template / Redirect URL
 * configuration.
 */
export async function inviteUserByEmail(
  email: string,
  {
    fullName,
    role,
    origin,
    context,
  }: { fullName?: string; role?: AppRole; origin: string; context: string },
): Promise<InviteResult> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });

  if (error || !data.user) {
    return { error: error?.message ?? "Could not create an invite for that email." };
  }

  if (role && role !== "member") {
    await admin.from("profiles").update({ role }).eq("id", data.user.id);
  }

  const confirmLink = `${origin}/auth/confirm?token_hash=${data.properties.hashed_token}&type=invite&next=/reset-password`;
  const { subject, html } = accountInviteEmail(context, confirmLink);
  await sendEmail(email, subject, html);

  return { userId: data.user.id };
}
