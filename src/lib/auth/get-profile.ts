import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/roles";

export type CurrentProfile = {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
};

/**
 * Reads the signed-in user's profile. On the gated surfaces (/admin, /org,
 * /app) this comes straight from headers proxy.ts already set after
 * verifying the session and role — no extra round trip to Supabase on
 * every navigation. Falls back to a direct fetch for any other caller.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const headerList = await headers();
  const id = headerList.get("x-user-id");
  const role = headerList.get("x-user-role") as AppRole | null;

  if (id && role) {
    return {
      id,
      email: headerList.get("x-user-email") ?? "",
      fullName: headerList.get("x-user-full-name") || null,
      role,
    };
  }

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
