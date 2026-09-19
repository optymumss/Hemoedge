"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_TABLES, type ContentType } from "@/lib/content/types";
import { logAudit } from "@/lib/audit/log";
import { sendEmail } from "@/lib/email/send";
import { reviewDecisionEmail } from "@/lib/email/templates";

/** A Content Manager submits their draft (or bounced work) for Super Admin review. */
export async function submitForReview(formData: FormData) {
  const contentType = String(formData.get("content_type")) as ContentType;
  const id = String(formData.get("id"));
  const path = String(formData.get("path") ?? "/admin/review-queue");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const table = CONTENT_TABLES[contentType];
  await supabase.from(table).update({ status: "in_review" }).eq("id", id);
  await supabase.from("content_reviews").insert({
    content_type: contentType,
    content_id: id,
    submitted_by: user.id,
  });

  const { data: submittedContent } = await supabase.from(table).select("title").eq("id", id).single();
  if (submittedContent) {
    try {
      await supabase.from("notifications").insert({
        recipient_role: "super_admin",
        kind: "submission_pending",
        content_type: contentType,
        content_id: id,
        title: submittedContent.title,
      });
    } catch {
      // Best-effort: a missed notification never fails the submission itself.
    }
  }

  revalidatePath(path);
  revalidatePath("/admin/review-queue");
}

/** A Super Admin approves (-> published) or bounces (-> changes_requested) a submission. */
export async function reviewContent(formData: FormData) {
  const contentType = String(formData.get("content_type")) as ContentType;
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision")) as
    | "approved"
    | "changes_requested";
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const table = CONTENT_TABLES[contentType];
  await supabase
    .from(table)
    .update({
      status: decision === "approved" ? "published" : "changes_requested",
    })
    .eq("id", id);

  const { data: pending } = await supabase
    .from("content_reviews")
    .select("id, submitted_by")
    .eq("content_type", contentType)
    .eq("content_id", id)
    .is("decision", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pending) {
    await supabase
      .from("content_reviews")
      .update({
        decision,
        notes,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", pending.id);
  }

  await logAudit(supabase, user.id, "content_reviewed", contentType, id, {
    decision,
    notes,
  });

  if (pending) {
    const [{ data: content }, { data: submitter }] = await Promise.all([
      supabase.from(table).select("title").eq("id", id).single(),
      supabase.from("profiles").select("email").eq("id", pending.submitted_by).single(),
    ]);
    if (content && submitter) {
      const { subject, html } = reviewDecisionEmail(content.title, decision, notes);
      await sendEmail(submitter.email, subject, html);
    }
    if (content) {
      try {
        await supabase.from("notifications").insert({
          recipient_id: pending.submitted_by,
          kind: "review_decision",
          content_type: contentType,
          content_id: id,
          title: content.title,
          decision,
        });
      } catch {
        // Best-effort: a missed notification never fails the review decision itself.
      }
    }
  }

  revalidatePath("/admin/review-queue");
}
