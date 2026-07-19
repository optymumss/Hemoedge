import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PageHeader } from "@/components/page-header";

export default async function TeamPage() {
  const supabase = await createClient();
  const { data: associates } = await supabase
    .from("associates")
    .select("id, name, title, bio")
    .order("name");

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-16 sm:py-20">
        <PageHeader eyebrow="Team" title="The people behind HemoEdge" />

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {(associates ?? []).map((a) => (
            <div key={a.id} className="rounded-lg border border-line bg-surface-raised p-5">
              <h2 className="font-medium text-ink">{a.name}</h2>
              {a.title && (
                <p className="mt-0.5 text-xs uppercase tracking-wide text-ink-faint">{a.title}</p>
              )}
              {a.bio && <p className="mt-2 text-sm text-ink-dim">{a.bio}</p>}
            </div>
          ))}
          {(associates ?? []).length === 0 && (
            <p className="col-span-full text-center text-sm text-ink-faint">
              No team members listed yet.
            </p>
          )}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
