/** Small colored icons paired with dashboard section headings — matches
 * the reference design's convention of a brand-red outline icon next to
 * each section title (Quick Access is the one exception, using the
 * neutral ink color instead of red). */

export function MicroscopeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6.5 2.5 10 6M5 4l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6.8 6.2 4.3 8.7a1.6 1.6 0 0 0 2.26 2.26l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 10.5 3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M2.5 14h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.5 9.5 13 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M11 11.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function TrophyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M5 2.5h6v4a3 3 0 0 1-6 0v-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5 3.5H3a1.5 1.5 0 0 0 0 3h.7M11 3.5h2a1.5 1.5 0 0 1 0 3h-.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M8 9.5v2M6 14h4M6.5 11.5h3l.5 2h-4l.5-2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RibbonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.7 9 5 14l3-1.5 3 1.5-.7-5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function TargetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="8" r="0.75" fill="currentColor" />
    </svg>
  );
}

export function ChainLinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="6" height="4" rx="2" transform="rotate(-45 5 8)" stroke="currentColor" strokeWidth="1.4" />
      <rect x="8" y="6" width="6" height="4" rx="2" transform="rotate(-45 11 8)" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
