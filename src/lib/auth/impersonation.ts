import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export const IMPERSONATION_COOKIE = "impersonation_session";

export type ActiveImpersonation = {
  sessionId: string;
  target: { id: string; email: string; fullName: string | null; role: AppRole };
};

/** Validates the cookie's session against the real auth session on every
 * call — the cookie only ever carries an opaque id, never trusted alone. */
export async function getActiveImpersonation(): Promise<ActiveImpersonation | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  if (!sessionId) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("id, actor_id, ended_at, profiles!impersonation_sessions_target_id_fkey(id, email, full_name, role)")
    .eq("id", sessionId)
    .maybeSingle();

  if (!session || session.actor_id !== user.id || session.ended_at || !session.profiles) {
    return null;
  }

  return {
    sessionId: session.id,
    target: {
      id: session.profiles.id,
      email: session.profiles.email,
      fullName: session.profiles.full_name,
      role: session.profiles.role,
    },
  };
}

/** The user id whose data should be shown — the impersonation target if an
 * active "view as" session exists, otherwise the real signed-in user. */
export async function getEffectiveUserId(): Promise<string | null> {
  const active = await getActiveImpersonation();
  if (active) return active.target.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
