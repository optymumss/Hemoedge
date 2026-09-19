import { createClient } from "@/lib/supabase/server";
import { PublicNav } from "@/components/public-nav";
import { PublicFooter } from "@/components/public-footer";
import { PageHeader } from "@/components/page-header";
import { ContactForm } from "./contact-form";
import { getSiteSettings } from "@/lib/site-settings/get-site-settings";

export default async function ContactPage() {
  const supabase = await createClient();
  const siteSettings = await getSiteSettings(supabase);
  const { data: page } = await supabase
    .from("pages")
    .select("title, content")
    .eq("type", "contact")
    .eq("status", "published")
    .limit(1)
    .maybeSingle();

  return (
    <>
      <PublicNav siteSettings={siteSettings} />
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-16 sm:py-20">
        <PageHeader title={page?.title || "Contact us"} description={page?.content ?? undefined} />

        <div className="mt-10 rounded-lg border border-line bg-surface-raised p-6">
          <ContactForm />
        </div>
      </main>
      <PublicFooter siteSettings={siteSettings} />
    </>
  );
}
