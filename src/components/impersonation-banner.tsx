import { endImpersonation } from "@/app/admin/learners/impersonation-actions";

export function ImpersonationBanner({ name }: { name: string }) {
  return (
    <div className="flex items-center justify-between bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span>Viewing as {name} — read-only</span>
      <form action={endImpersonation}>
        <button type="submit" className="rounded-md bg-amber-950/10 px-2 py-1 underline">
          Exit
        </button>
      </form>
    </div>
  );
}
