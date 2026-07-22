"use client";

import { useActionState } from "react";
import { createPage, type FormState } from "./actions";

export function PageForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createPage,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="page-title">Title</label>
        <input
          id="page-title"
          name="title"
          required
          className="w-56 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="page-type">Type</label>
        <select
          id="page-type"
          name="type"
          defaultValue="custom"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="homepage">Homepage</option>
          <option value="about">About</option>
          <option value="contact">Contact</option>
          <option value="pilot">Pilot</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div className="flex flex-1 min-w-64 flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="page-content">Content (optional)</label>
        <input
          id="page-content"
          name="content"
          className="w-full rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create page"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
