const STYLES: Record<string, string> = {
  draft: "bg-surface-sunken text-ink-dim",
  in_review: "bg-info-soft text-info-soft-ink",
  changes_requested: "bg-warning-soft text-warning-soft-ink",
  published: "bg-success-soft text-success-soft-ink",
};

const LABELS: Record<string, string> = {
  draft: "Draft",
  in_review: "In Review",
  changes_requested: "Changes Requested",
  published: "Published",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-surface-sunken text-ink-dim"}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
