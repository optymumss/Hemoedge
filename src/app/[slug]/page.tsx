import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";

export default async function CmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: page } = await supabase
    .from("pages")
    .select("title, content, type")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!page || page.type === "homepage") {
    notFound();
  }

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16 sm:py-20">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{page.title}</h1>
        {page.content && (
          <p className="mt-6 whitespace-pre-line text-base leading-7 text-ink-dim">
            {page.content}
          </p>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
