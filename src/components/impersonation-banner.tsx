import { endImpersonation } from "@/app/admin/learners/impersonation-actions";

export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between border-b border-warning bg-warning-soft px-4 py-2 text-sm font-medium text-warning-soft-ink">
      <span>Viewing as {name} — read-only</span>
      <form action={endImpersonation}>
        <button
          type="submit"
          className="rounded-md border border-warning px-2 py-1 text-xs underline hover:bg-warning/10"
        >
          Exit
        </button>
      </form>
    </div>
  );
}
