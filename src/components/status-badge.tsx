const STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600",
  in_review: "bg-blue-50 text-blue-700",
  changes_requested: "bg-amber-50 text-amber-700",
  published: "bg-green-50 text-green-700",
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
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[status] ?? "bg-neutral-100 text-neutral-600"}`}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
