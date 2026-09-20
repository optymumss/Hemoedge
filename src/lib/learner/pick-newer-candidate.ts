export type FallbackCandidate = {
  slideId: string;
  title: string;
  href: string;
  createdAt: string;
};

export function pickNewerCandidate(
  a: FallbackCandidate | null,
  b: FallbackCandidate | null,
): FallbackCandidate | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a.createdAt).getTime() >= new Date(b.createdAt).getTime() ? a : b;
}
