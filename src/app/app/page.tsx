import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function LearnerHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user!.id)
    .single();

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">
            HemoEdge
          </p>
          <h1 className="text-xl font-semibold">
            Welcome, {profile?.full_name || profile?.email}
          </h1>
        </div>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Sign out
          </button>
        </form>
      </header>
      <p className="text-sm text-neutral-600">
        This is a placeholder for the learner dashboard — continue learning,
        modules, cases, the feature library, and the competency pathway.
      </p>
    </main>
  );
}
