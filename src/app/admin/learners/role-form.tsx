"use client";

import { updateRole } from "./actions";
import type { Enums } from "@/lib/supabase/database.types";

export function RoleForm({
  userId,
  role,
}: {
  userId: string;
  role: Enums<"app_role">;
}) {
  return (
    <form action={updateRole}>
      <input type="hidden" name="user_id" value={userId} />
      <select
        key={role}
        name="role"
        defaultValue={role}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-line-strong px-2 py-1 text-xs"
      >
        <option value="member">Member</option>
        <option value="content_manager">Content Manager</option>
        <option value="org_admin">Org Admin</option>
        <option value="super_admin">Super Admin</option>
      </select>
    </form>
  );
}
