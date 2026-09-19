export type NotificationRow = {
  id: string;
  kind: "submission_pending" | "review_decision";
  content_type: "slide" | "feature" | "module" | "case" | "curriculum";
  content_id: string;
  title: string;
  decision: "approved" | "changes_requested" | null;
  created_at: string;
};

const CONTENT_TYPE_PLURAL: Record<NotificationRow["content_type"], string> = {
  slide: "slides",
  feature: "features",
  module: "modules",
  case: "cases",
  curriculum: "curricula",
};

export function buildNotificationHref(n: NotificationRow): string {
  if (n.kind === "submission_pending") return "/admin/review-queue";
  return `/admin/${CONTENT_TYPE_PLURAL[n.content_type]}/${n.content_id}`;
}

export function formatNotificationMessage(n: NotificationRow): string {
  if (n.kind === "submission_pending") return `New submission awaiting review: "${n.title}"`;
  if (n.decision === "approved") return `"${n.title}" was approved`;
  return `"${n.title}" needs changes`;
}

export function countUnread(notifications: NotificationRow[], lastViewedAt: string | null): number {
  const cutoff = lastViewedAt ? new Date(lastViewedAt).getTime() : 0;
  return notifications.filter((n) => new Date(n.created_at).getTime() > cutoff).length;
}
