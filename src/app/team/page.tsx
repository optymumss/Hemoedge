import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: associates } = await supabase
    .from("associates")
    .select("id, name, title, bio")
    .order("name");

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Team</h1>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {(associates ?? []).map((a) => (
            <div key={a.id} className="rounded-lg border border-neutral-200 p-4">
              <h2 className="font-medium">{a.name}</h2>
              {a.title && <p className="text-xs uppercase text-neutral-400">{a.title}</p>}
              {a.bio && <p className="mt-2 text-sm text-neutral-600">{a.bio}</p>}
            </div>
          ))}
          {(associates ?? []).length === 0 && (
            <p className="col-span-full text-sm text-neutral-400">No team members listed yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
