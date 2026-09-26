export type TilingJobRequest = { jobId: string; slideId: string; rawFileUrl: string };

type ParseResult =
  | { ok: true; job: TilingJobRequest }
  | { ok: false; status: 400 | 401; error: string };

async function sameSecret(provided: string, expected: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  // Comparing fixed-length digests keeps the check constant-time regardless
  // of the provided token's length.
  const x = new Uint8Array(a);
  const y = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function parseJobRequest(request: Request, secret: string): Promise<ParseResult> {
  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : "";
  if (!provided || !(await sameSecret(provided, secret))) {
    return { ok: false, status: 401, error: "Unauthorized" };
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  const slideId = typeof body?.slideId === "string" ? body.slideId : "";
  const rawFileUrl = typeof body?.rawFileUrl === "string" ? body.rawFileUrl : "";
  if (!jobId || !slideId || !rawFileUrl.startsWith("https://")) {
    return { ok: false, status: 400, error: "Missing jobId, slideId, or an https rawFileUrl" };
  }
  return { ok: true, job: { jobId, slideId, rawFileUrl } };
}
