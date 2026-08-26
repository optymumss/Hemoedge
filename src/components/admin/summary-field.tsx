/**
 * A single label/value row on a content type's read-only summary page —
 * shared across Modules, Case Studies, Learning Pathways, and Features so
 * their "view before you edit" pages look and behave the same way.
 */
export function SummaryField({
  label,
  value,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-ink-dim">{label}</dt>
      <dd className={`text-sm text-ink ${multiline ? "whitespace-pre-wrap" : ""}`}>
        {value || <span className="text-ink-faint">—</span>}
      </dd>
    </div>
  );
}
