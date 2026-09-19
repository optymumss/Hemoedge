import { describe, it, expect } from "vitest";
import {
  buildNotificationHref,
  formatNotificationMessage,
  countUnread,
  type NotificationRow,
} from "./format-notifications";

function makeRow(overrides: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    id: overrides.id,
    kind: overrides.kind ?? "submission_pending",
    content_type: overrides.content_type ?? "module",
    content_id: overrides.content_id ?? "content-1",
    title: overrides.title ?? "Some Title",
    decision: overrides.decision ?? null,
    created_at: overrides.created_at ?? "2026-09-19T00:00:00.000Z",
  };
}

describe("buildNotificationHref", () => {
  it("links submission_pending to the review queue", () => {
    const row = makeRow({ id: "a", kind: "submission_pending" });
    expect(buildNotificationHref(row)).toBe("/admin/review-queue");
  });

  it("links review_decision to the content's own admin page for each content type", () => {
    const cases: [NotificationRow["content_type"], string][] = [
      ["slide", "slides"],
      ["feature", "features"],
      ["module", "modules"],
      ["case", "cases"],
      ["curriculum", "curricula"],
    ];
    for (const [contentType, plural] of cases) {
      const row = makeRow({
        id: contentType,
        kind: "review_decision",
        content_type: contentType,
        content_id: "xyz",
        decision: "approved",
      });
      expect(buildNotificationHref(row)).toBe(`/admin/${plural}/xyz`);
    }
  });
});

describe("formatNotificationMessage", () => {
  it("formats a submission_pending message", () => {
    const row = makeRow({ id: "a", kind: "submission_pending", title: "Iron Deficiency Anaemia" });
    expect(formatNotificationMessage(row)).toBe('New submission awaiting review: "Iron Deficiency Anaemia"');
  });

  it("formats an approved review_decision message", () => {
    const row = makeRow({ id: "a", kind: "review_decision", decision: "approved", title: "My Module" });
    expect(formatNotificationMessage(row)).toBe('"My Module" was approved');
  });

  it("formats a changes_requested review_decision message", () => {
    const row = makeRow({ id: "a", kind: "review_decision", decision: "changes_requested", title: "My Module" });
    expect(formatNotificationMessage(row)).toBe('"My Module" needs changes');
  });
});

describe("countUnread", () => {
  it("counts everything as unread when lastViewedAt is null", () => {
    const rows = [
      makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
      makeRow({ id: "b", created_at: "2026-02-01T00:00:00.000Z" }),
    ];
    expect(countUnread(rows, null)).toBe(2);
  });

  it("counts nothing as unread when lastViewedAt is after every notification", () => {
    const rows = [makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" })];
    expect(countUnread(rows, "2026-06-01T00:00:00.000Z")).toBe(0);
  });

  it("counts only notifications strictly newer than lastViewedAt (boundary: equal does not count)", () => {
    const rows = [
      makeRow({ id: "a", created_at: "2026-01-01T00:00:00.000Z" }),
      makeRow({ id: "b", created_at: "2026-03-01T00:00:00.000Z" }),
    ];
    expect(countUnread(rows, "2026-01-01T00:00:00.000Z")).toBe(1);
  });

  it("returns 0 for an empty notification list", () => {
    expect(countUnread([], null)).toBe(0);
  });
});
