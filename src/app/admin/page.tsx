import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function AdminHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, email")
    .eq("id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            HemoEdge Admin
          </p>
          <h1 className="text-xl font-semibold">
            {profile?.role === "super_admin" ? "Super Admin" : "Content Manager"}
          </h1>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>
      <p className="text-sm text-neutral-600">
        Signed in as {profile?.full_name || profile?.email}. This is a
        placeholder for the Library, Module, and Case Management surfaces —
        Content Managers author here and Super Admins additionally manage
        Organizations, Tiers, and the Site CMS.
      </p>
    </main>
  );
}
