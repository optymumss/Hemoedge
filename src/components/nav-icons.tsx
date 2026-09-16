const ICON_PATHS: Record<string, React.ReactNode> = {
  Dashboard: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  Cases: (
    <path
      d="M2 4.5A1.5 1.5 0 0 1 3.5 3h2.6l1 1.4h5.4A1.5 1.5 0 0 1 14 5.9v5.6A1.5 1.5 0 0 1 12.5 13h-9A1.5 1.5 0 0 1 2 11.5v-7Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  "Learning Pathways": (
    <path
      d="M8 2 3 3.6v3.9c0 3.2 2.1 5.9 5 6.5 2.9-.6 5-3.3 5-6.5V3.6L8 2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Competencies: (
    <>
      <path
        d="M3 3.5A1.5 1.5 0 0 1 4.5 2h5.8L13 4.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 3 13.5v-10Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M5.5 8.2 7 9.7l3.5-3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  Certificates: (
    <>
      <circle cx="8" cy="6" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.8 9.4 5 14l3-1.5L11 14l-.8-4.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  Modules: (
    <path
      d="M3 2.5h6.5A1.5 1.5 0 0 1 11 4v9.5H4.5A1.5 1.5 0 0 1 3 12V2.5Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  Library: (
    <>
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6h11M6 6v7.5" stroke="currentColor" strokeWidth="1.4" />
    </>
  ),
  "Manual Diff Counter": (
    <path
      d="M11.5 2.5 4.6 9.4a1 1 0 0 0 0 1.4l.6.6a1 1 0 0 0 1.4 0l6.9-6.9-2-2Z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  "Cell Identification": (
    <>
      <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.4" />
      <path d="m11.5 11.5 2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="6.5" cy="6.5" r="1.4" fill="currentColor" />
    </>
  ),
};

/** Rendered for any nav label with no entry in ICON_PATHS above — currently
 * every org/admin item other than the labels they share with the learner
 * nav (Modules, Learning Pathways, Manual Diff Counter, Cell Identification).
 * A placeholder until those portals get their own reference mockups. */
const FALLBACK_ICON: React.ReactNode = <circle cx="8" cy="8" r="3" fill="currentColor" />;

export function NavIcon({ label }: { label: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      {ICON_PATHS[label] ?? FALLBACK_ICON}
    </svg>
  );
}
