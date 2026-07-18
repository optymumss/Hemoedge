import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">{post.title}</h1>
        {post.published_at && (
          <p className="mt-1 text-xs text-neutral-400">
            {new Date(post.published_at).toLocaleDateString()}
          </p>
        )}
        {post.content && (
          <p className="mt-6 whitespace-pre-line text-sm text-neutral-700">{post.content}</p>
        )}
      </main>
    </>
  );
}
