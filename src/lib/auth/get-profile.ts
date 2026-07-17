import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
};

/** Reads the signed-in user's profile. Assumes proxy.ts already enforced auth. */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: user.id,
    email: profile.email,
    fullName: profile.full_name,
    role: profile.role,
  };
}
