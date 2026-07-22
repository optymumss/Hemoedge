"use client";

import { useActionState } from "react";
import { submitEnquiry, type FormState } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitEnquiry,
    undefined,
  );

  if (state?.success) {
    return (
      <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success-soft-ink">
        Thanks — we&apos;ll get back to you shortly.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="contact-name">
          Name
        </label>
        <input
          id="contact-name"
          name="name"
          required
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="contact-email">
          Email
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="contact-message">
          Message
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={5}
          className="rounded-md border border-line-strong px-3 py-2 text-sm"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
