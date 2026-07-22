"use client";

import { useActionState, useState } from "react";
import { deleteOwnAccount, type DeleteAccountState } from "@/lib/auth/account-actions";

export function DeleteAccountSection() {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(
    deleteOwnAccount,
    undefined,
  );
  const [confirmText, setConfirmText] = useState("");

  return (
    <div className="rounded-lg border border-danger bg-danger-soft p-5">
      <h2 className="text-sm font-semibold text-danger-soft-ink">Delete account</h2>
      <p className="mt-1 text-sm text-danger-soft-ink">
        Please proceed with caution — this cannot be undone. Your organization memberships,
        certificates, and quiz history will be permanently deleted.
      </p>
      <form action={action} className="mt-4 flex flex-col gap-2">
        <label htmlFor="delete-confirm" className="text-xs text-danger-soft-ink">
          Type <span className="font-mono font-semibold">DELETE</span> to confirm
        </label>
        <input
          id="delete-confirm"
          name="confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="max-w-xs rounded-md border border-danger bg-surface-raised px-3 py-2 text-sm"
        />
        {state?.error && <p className="text-sm text-danger-soft-ink">{state.error}</p>}
        <button
          type="submit"
          disabled={pending || confirmText !== "DELETE"}
          className="mt-1 self-start rounded-md bg-danger px-4 py-2 text-sm font-medium text-danger-ink disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Delete account"}
        </button>
      </form>
    </div>
  );
}
