import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/get-profile";
import { ComingSoon } from "@/components/coming-soon";
import { TestimonialForm } from "./testimonial-form";
import { toggleTestimonialPublished } from "./actions";

export default async function TestimonialsPage() {
  const profile = await getCurrentProfile();
  if (profile?.role !== "super_admin") {
    return <ComingSoon title="Super Admin only" description="Testimonials are managed by HemoEdge staff." />;
  }

  const supabase = await createClient();
  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("id, author_name, author_title, quote, published")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Testimonials</h1>

      <div className="mt-6 rounded-lg border border-line p-4">
        <TestimonialForm />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {(testimonials ?? []).map((t) => (
          <div key={t.id} className="rounded-lg border border-line p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm italic text-ink">&ldquo;{t.quote}&rdquo;</p>
                <p className="mt-1 text-xs text-ink-dim">
                  {t.author_name}
                  {t.author_title ? `, ${t.author_title}` : ""}
                </p>
              </div>
              <form action={toggleTestimonialPublished}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="next_published" value={String(!t.published)} />
                <button type="submit" className="whitespace-nowrap text-xs text-info-soft-ink underline">
                  {t.published ? "Unpublish" : "Publish"}
                </button>
              </form>
            </div>
          </div>
        ))}
        {(testimonials ?? []).length === 0 && (
          <p className="py-6 text-center text-sm text-ink-faint">No testimonials yet.</p>
        )}
      </div>
    </div>
  );
}
