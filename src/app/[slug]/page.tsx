import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";

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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">{page.title}</h1>
        {page.content && (
          <p className="mt-4 whitespace-pre-line text-sm text-neutral-600">{page.content}</p>
        )}
      </main>
    </>
  );
}
