import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

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
      <main className="flex flex-1 flex-col items-center gap-4 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold">{homepage?.title || "HemoEdge"}</h1>
        <p className="max-w-sm text-sm text-neutral-600">
          {homepage?.content ||
            "WSI-based blood cell morphology training for laboratory professionals."}
        </p>
        <Link
          href="/login"
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Sign in
        </Link>

        {(testimonials ?? []).length > 0 && (
          <div className="mt-12 grid w-full max-w-3xl gap-4 text-left sm:grid-cols-2">
            {(testimonials ?? []).map((t) => (
              <blockquote
                key={t.id}
                className="rounded-lg border border-neutral-200 p-4 text-sm text-neutral-700"
              >
                <p>&ldquo;{t.quote}&rdquo;</p>
                <footer className="mt-2 text-xs text-neutral-500">
                  {t.author_name}
                  {t.author_title ? `, ${t.author_title}` : ""}
                </footer>
              </blockquote>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
