import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HashFragmentFallback } from "./hash-fragment-fallback";

type EmailOtpType = "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email";

const VALID_TYPES: EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing point for Supabase email links (signup confirmation, password
 * recovery, invite). Supabase can deliver the session two different ways
 * depending on how the project's email templates are configured:
 *
 * 1. `token_hash`/`type` as query params on this URL — verified server-side
 *    below, which is the modern/documented path.
 * 2. The default template instead sends the click through Supabase's own
 *    hosted verify endpoint first, which redirects back here with the
 *    session as a URL fragment (#access_token=...) — invisible server-side,
 *    since fragments never reach the server. HashFragmentFallback handles
 *    that case client-side.
 *
 * Handling both means this works regardless of which template style the
 * project ends up with, without needing to touch the Supabase dashboard.
 */
export default async function AuthConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  const target = next ?? "/";

  if (token_hash && type && VALID_TYPES.includes(type as EmailOtpType)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    });
    if (!error) redirect(target);
  }

  return <HashFragmentFallback next={target} />;
}
