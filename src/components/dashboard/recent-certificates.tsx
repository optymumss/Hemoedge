import Link from "next/link";
import type { RecentCertificate } from "@/lib/learner/get-recent-certificates";

export function RecentCertificates({ certificates }: { certificates: RecentCertificate[] }) {
  if (certificates.length === 0) return null;

  return (
    <div className="mt-4 rounded-lg border border-line p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-dim">Recently Earned</p>
      <div className="mt-3 flex flex-col gap-3">
        {certificates.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{c.title}</p>
              <p className="text-xs text-ink-faint">Earned on {new Date(c.issuedAt).toLocaleDateString()}</p>
            </div>
            <span className="shrink-0 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-soft-ink">
              Earned
            </span>
          </div>
        ))}
      </div>
      <Link href="/app/certificates" className="mt-3 inline-block text-xs font-medium text-accent hover:underline">
        Browse all certificates &rarr;
      </Link>
    </div>
  );
}
