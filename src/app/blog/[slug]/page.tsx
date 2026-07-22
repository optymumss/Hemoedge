import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("blog_posts")
    .select("title, content, published_at")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!post) {
    notFound();
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-20">
        <Link href="/blog" className="text-sm text-ink-dim hover:text-ink">
          &larr; Blog
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-ink">{post.title}</h1>
        {post.published_at && (
          <p className="mt-2 text-xs text-ink-faint">
            {new Date(post.published_at).toLocaleDateString()}
          </p>
        )}
        {post.content && (
          <p className="mt-8 whitespace-pre-line text-base leading-7 text-ink">{post.content}</p>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
