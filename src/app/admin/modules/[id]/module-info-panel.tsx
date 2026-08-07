import { StatusBadge } from "@/components/status-badge";
import { SubmitForReviewButton } from "@/components/submit-for-review-button";
import { MODULE_TYPE_LABEL } from "./details-form";

type ModuleSummary = {
  id: string;
  title: string;
  level: string;
  status: string;
  module_type: string | null;
  estimated_duration_minutes: number | null;
  cpd_points: number;
  created_at: string;
};

export function ModuleInfoPanel({ module_ }: { module_: ModuleSummary }) {
  return (
    <aside className="w-64 shrink-0 rounded-lg border border-line p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Overview</span>
        <StatusBadge status={module_.status} />
      </div>
      <h2 className="mt-2 text-sm font-semibold leading-snug">{module_.title}</h2>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-ink-faint">Level</dt>
          <dd className="capitalize text-ink">{module_.level}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-faint">Type</dt>
          <dd className="text-ink">{module_.module_type ? MODULE_TYPE_LABEL[module_.module_type] : "—"}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-faint">Duration</dt>
          <dd className="text-ink">
            {module_.estimated_duration_minutes ? `${module_.estimated_duration_minutes} min` : "—"}
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-faint">CPD points</dt>
          <dd className="text-ink">{module_.cpd_points}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-ink-faint">Created</dt>
          <dd className="text-ink">{new Date(module_.created_at).toLocaleDateString()}</dd>
        </div>
      </dl>

      {(module_.status === "draft" || module_.status === "changes_requested") && (
        <div className="mt-4 border-t border-line pt-3">
          <SubmitForReviewButton contentType="module" id={module_.id} path={`/admin/modules/${module_.id}`} />
        </div>
      )}
    </aside>
  );
}
