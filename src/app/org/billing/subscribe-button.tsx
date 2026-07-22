"use client";

import { useState } from "react";

export function SubscribeButton({
  tierId,
  interval,
  label,
}: {
  tierId: string;
  interval: "monthly" | "yearly";
  label: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier_id: tierId, interval }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setPending(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach billing.");
      setPending(false);
    }
  }

  return (
    <div>
      <button
        onClick={subscribe}
        disabled={pending}
        className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
      >
        {pending ? "Redirecting…" : label}
      </button>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
