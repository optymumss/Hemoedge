import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { ContactForm } from "./contact-form";

export default async function ContactPage() {
  const supabase = await createClient();
  const { data: page } = await supabase
    .from("pages")
    .select("title, content")
    .eq("type", "contact")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  return (
    <>
      <PublicNav />
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
        <h1 className="text-2xl font-semibold">{page?.title || "Contact us"}</h1>
        {page?.content && (
          <p className="mt-2 text-sm text-ink-dim">{page.content}</p>
        )}

        <div className="mt-8">
          <ContactForm />
        </div>
      </main>
    </>
  );
}
