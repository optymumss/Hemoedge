"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { IMPERSONATION_COOKIE } from "@/lib/auth/impersonation";
import { logAudit } from "@/lib/audit/log";
import { defaultRouteForRole } from "@/lib/auth/roles";

export async function startImpersonation(formData: FormData) {
  const targetUserId = String(formData.get("user_id") ?? "");
  if (!targetUserId) return;

  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") return;

  const supabase = await createClient();

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", targetUserId)
    .single();

  const { data: session, error } = await supabase
    .from("impersonation_sessions")
    .insert({ actor_id: profile.id, target_id: targetUserId })
    .select("id")
    .single();

  if (error || !session) return;

  await logAudit(supabase, profile.id, "impersonation_started", "profile", targetUserId, {});

  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  redirect(defaultRouteForRole(target?.role));
}

export async function endImpersonation() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value;
  cookieStore.delete(IMPERSONATION_COOKIE);

  if (!sessionId) {
    redirect("/admin/learners");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: session } = await supabase
    .from("impersonation_sessions")
    .select("id, actor_id, target_id")
    .eq("id", sessionId)
    .maybeSingle();

  if (session && user && session.actor_id === user.id) {
    await supabase
      .from("impersonation_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    await logAudit(supabase, user.id, "impersonation_ended", "profile", session.target_id, {});
  }

  redirect("/admin/learners");
}
