"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { NotificationRow } from "@/lib/notifications/format-notifications";
import { buildNotificationHref, formatNotificationMessage, countUnread } from "@/lib/notifications/format-notifications";
import { markNotificationsViewed } from "@/lib/notifications/mark-viewed";

export function NotificationBell({
  notifications,
  lastViewedAt: initialLastViewedAt,
}: {
  notifications: NotificationRow[];
  lastViewedAt: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [lastViewedAt, setLastViewedAt] = useState(initialLastViewedAt);
  const containerRef = useRef<HTMLDivElement>(null);

  const unread = countUnread(notifications, lastViewedAt);
  const badgeLabel = unread > 9 ? "9+" : String(unread);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToggle() {
    setOpen((wasOpen) => {
      const willOpen = !wasOpen;
      if (willOpen && unread > 0) {
        setLastViewedAt(new Date().toISOString());
        void markNotificationsViewed();
      }
      return willOpen;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-md p-2 text-ink-dim hover:bg-surface-sunken"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M9 2.5c-2.2 0-4 1.8-4 4v2.3c0 .5-.2 1-.5 1.4L3.4 11.5A1 1 0 0 0 4.2 13h9.6a1 1 0 0 0 .8-1.5l-1.1-1.3a2 2 0 0 1-.5-1.4V6.5c0-2.2-1.8-4-4-4Z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M7.5 15a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium leading-none text-danger-soft-ink">
            {badgeLabel}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 max-h-80 w-80 overflow-y-auto rounded-md border border-line-strong bg-surface shadow-lg">
          {notifications.length === 0 && (
            <p className="px-3 py-4 text-center text-sm text-ink-faint">No notifications yet.</p>
          )}
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={buildNotificationHref(n)}
              onClick={() => setOpen(false)}
              className={`block border-l-4 px-3 py-2 text-sm hover:bg-surface-sunken ${
                n.kind === "review_decision"
                  ? n.decision === "approved"
                    ? "border-l-success text-ink"
                    : "border-l-danger text-ink"
                  : "border-l-transparent text-ink"
              }`}
            >
              {formatNotificationMessage(n)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
