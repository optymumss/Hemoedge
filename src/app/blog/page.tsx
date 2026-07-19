import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PageHeader } from "@/components/page-header";

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, title, excerpt, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-20">
        <PageHeader eyebrow="Blog" title="Notes from the lab" />

        <div className="mt-12 flex flex-col divide-y divide-line">
          {(posts ?? []).map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group block py-6 first:pt-0">
              <h2 className="text-lg font-medium text-ink group-hover:text-accent">{p.title}</h2>
              {p.excerpt && <p className="mt-1.5 text-sm text-ink-dim">{p.excerpt}</p>}
              {p.published_at && (
                <p className="mt-2 text-xs text-ink-faint">
                  {new Date(p.published_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
          {(posts ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-ink-faint">Nothing published yet.</p>
          )}
        </div>
      </main>
      <PublicFooter />
    </>
  );
}
