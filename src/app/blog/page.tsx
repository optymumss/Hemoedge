import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">Blog</h1>

        <div className="mt-8 flex flex-col gap-6">
          {(posts ?? []).map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="block group">
              <h2 className="font-medium group-hover:underline">{p.title}</h2>
              {p.excerpt && <p className="mt-1 text-sm text-neutral-600">{p.excerpt}</p>}
              {p.published_at && (
                <p className="mt-1 text-xs text-neutral-400">
                  {new Date(p.published_at).toLocaleDateString()}
                </p>
              )}
            </Link>
          ))}
          {(posts ?? []).length === 0 && (
            <p className="text-sm text-neutral-400">Nothing published yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
