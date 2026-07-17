"use client";

import { useActionState } from "react";
import { createPost, type FormState } from "./actions";

export function PostForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createPost,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500">Title</label>
        <input
          name="title"
          required
          className="w-56 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-neutral-500">Excerpt (optional)</label>
        <input
          name="excerpt"
          className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create post"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
