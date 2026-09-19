import { getGreeting, firstName } from "@/lib/greeting";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";

export function Header({ identity }: { identity: string }) {
  const greeting = getGreeting(new Date(), firstName(identity));

  return (
    <header className="flex items-center justify-between gap-4 border-b border-line bg-surface px-4 py-4 sm:px-8">
      <div>
        <p className="text-lg font-semibold text-ink">{greeting}</p>
        <p className="text-sm text-ink-dim">You&apos;re doing great — keep up the momentum.</p>
      </div>

      <div className="flex items-center gap-3">
        <HeaderSearch />

        <button
          type="button"
          aria-label="Notifications"
          className="rounded-md p-2 text-ink-dim hover:bg-surface-sunken"
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
        </button>

        <ThemeToggle />
      </div>
    </header>
  );
}
