"use client";

import { deleteSlide } from "./actions";

export function DeleteSlideButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deleteSlide}
      onSubmit={(e) => {
        if (!confirm(`Delete "${title}"? This also removes the uploaded file.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-danger underline">
        Delete
      </button>
    </form>
  );
}
