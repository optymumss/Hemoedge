import { TrophyIcon } from "@/components/dashboard/section-icons";

export function RecentQuizScores({
  attempts,
}: {
  attempts: { id: string; title: string; score: number; passed: boolean }[];
}) {
  return (
    <div className="rounded-lg border border-line p-3">
      <p className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-wide text-accent">
        <TrophyIcon />
        Recent Quiz Scores
      </p>
      <div className="mt-2 flex flex-col gap-2">
        {attempts.map((a) => (
          <div key={a.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-ink">{a.title}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  a.passed ? "bg-success-soft text-success-soft-ink" : "bg-danger-soft text-danger-soft-ink"
                }`}
              >
                {a.score}% &middot; {a.passed ? "Pass" : "Fail"}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
              <div
                className={`h-full rounded-full ${a.passed ? "bg-success" : "bg-danger"}`}
                style={{ width: `${a.score}%` }}
              />
            </div>
          </div>
        ))}
        {attempts.length === 0 && <p className="text-sm text-ink-faint">No quiz attempts yet.</p>}
      </div>
    </div>
  );
}
