"use client";

import { useState } from "react";
import { reviewContent } from "@/lib/content/review-actions";
import type { ContentType } from "@/lib/content/types";

export function ReviewForm({
  contentType,
  id,
}: {
  contentType: ContentType;
  id: string;
}) {
  const [notes, setNotes] = useState("");

  return (
    <div className="flex flex-col gap-2">
      <input
        placeholder="Notes (required if requesting changes)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <form action={reviewContent}>
          <input type="hidden" name="content_type" value={contentType} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="approved" />
          <input type="hidden" name="notes" value={notes} />
          <button
            type="submit"
            className="rounded-md bg-green-700 px-2 py-1 text-xs font-medium text-white"
          >
            Approve &amp; publish
          </button>
        </form>
        <form action={reviewContent}>
          <input type="hidden" name="content_type" value={contentType} />
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="decision" value="changes_requested" />
          <input type="hidden" name="notes" value={notes} />
          <button
            type="submit"
            className="rounded-md border border-amber-600 px-2 py-1 text-xs font-medium text-amber-700"
          >
            Request changes
          </button>
        </form>
      </div>
    </div>
  );
}
