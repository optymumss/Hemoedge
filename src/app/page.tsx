import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

const FEATURES = [
  {
    title: "Real digital slides",
    description:
      "Pan and zoom whole-slide images the way you would at a microscope — not static crops or stock photos.",
  },
  {
    title: "Case-based learning",
    description:
      "Work through structured clinical cases with feature identification and quizzes graded as you go.",
  },
  {
    title: "Competency tracking",
    description:
      "Progress rolls up into a competency pathway, with certificates issued as modules are completed.",
  },
  {
    title: "Built for teams",
    description:
      "Lab and program managers roster learners, assign seats, and see cohort progress from one dashboard.",
  },
];

export default async function Home() {
  const supabase = await createClient();

  const { data: homepage } = await supabase
    .from("pages")
    .select("title, content")
    .eq("type", "homepage")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("id, author_name, author_title, quote")
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(6);

  return (
    <>
      <PublicNav />
      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center sm:py-28">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            WSI-based morphology training
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {homepage?.title || "Blood cell morphology, on real slides"}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-dim">
            {homepage?.content ||
              "HemoEdge trains laboratory professionals on whole-slide images, structured cases, and competency tracking built for hematology teams."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="rounded-md border border-line-strong px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface-sunken"
            >
              Talk to us
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-surface-sunken">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h2 className="text-sm font-semibold text-ink">{f.title}</h2>
                <p className="mt-2 text-sm text-ink-dim">{f.description}</p>
              </div>
            ))}
          </div>
        </section>

        {(testimonials ?? []).length > 0 && (
          <section className="mx-auto max-w-5xl px-6 py-16">
            <h2 className="text-center text-sm font-semibold uppercase tracking-wide text-ink-dim">
              What learners say
            </h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {(testimonials ?? []).map((t) => (
                <blockquote
                  key={t.id}
                  className="rounded-lg border border-line bg-surface-raised p-5 text-left text-sm text-ink"
                >
                  <p>&ldquo;{t.quote}&rdquo;</p>
                  <footer className="mt-3 text-xs text-ink-dim">
                    {t.author_name}
                    {t.author_title ? `, ${t.author_title}` : ""}
                  </footer>
                </blockquote>
              ))}
            </div>
          </section>
        )}

        <section className="border-t border-line">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              Ready to bring your team onto HemoEdge?
            </h2>
            <Link
              href="/contact"
              className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-ink hover:opacity-90"
            >
              Talk to us
            </Link>
          </div>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
