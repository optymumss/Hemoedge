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
        <label className="text-xs text-ink-dim" htmlFor="post-title">Title</label>
        <input
          id="post-title"
          name="title"
          required
          className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="post-excerpt">Excerpt (optional)</label>
        <input
          id="post-excerpt"
          name="excerpt"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create post"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
