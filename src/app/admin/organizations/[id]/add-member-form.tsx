"use client";

import { useActionState } from "react";
import { addOrgMember, type FormState } from "../actions";

export function AddMemberForm({ orgId }: { orgId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    addOrgMember,
    undefined,
  );

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="add-org-member-email">Email</label>
        <input
          id="add-org-member-email"
          name="email"
          type="email"
          required
          className="w-64 rounded-md border border-line-strong px-2 py-1.5 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-ink-dim" htmlFor="add-org-member-role">Role in org</label>
        <select
          id="add-org-member-role"
          name="org_role"
          defaultValue="member"
          className="rounded-md border border-line-strong px-2 py-1.5 text-sm"
        >
          <option value="member">Member (learner)</option>
          <option value="admin">Admin</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
      {state?.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
