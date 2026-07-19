"use client";

import { submitForReview } from "@/lib/content/review-actions";
import type { ContentType } from "@/lib/content/types";

export function SubmitForReviewButton({
  contentType,
  id,
  path,
}: {
  contentType: ContentType;
  id: string;
  path: string;
}) {
  return (
    <form action={submitForReview}>
      <input type="hidden" name="content_type" value={contentType} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="path" value={path} />
      <button type="submit" className="text-xs text-info-soft-ink underline">
        Submit for review
      </button>
    </form>
  );
}
