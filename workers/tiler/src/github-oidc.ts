/**
 * Verifies the OIDC ID token a GitHub Actions run mints for itself
 * (`permissions: id-token: write`). It is how the tiling workflow proves to
 * the tiler that it really is `.github/workflows/tiling.yml` on the default
 * branch of this repo, so GitHub needs no stored secrets at all -- the repo
 * is public, and anything kept there would be one mistake from leaking.
 */

export const GITHUB_OIDC_ISSUER = "https://token.actions.githubusercontent.com";
const JWKS_URL = `${GITHUB_OIDC_ISSUER}/.well-known/jwks`;
const CLOCK_SKEW_SECONDS = 60;
const JWKS_TTL_MS = 10 * 60 * 1000;

export type OidcExpectations = {
  audience: string;
  /** "owner/repo"; GitHub preserves the repo's case, so compared case-insensitively. */
  repository: string;
  /** Workflow file name, e.g. "tiling.yml". */
  workflow: string;
  /** Branch the workflow must run from, e.g. "main". */
  ref: string;
};

type Jwk = JsonWebKey & { kid?: string };
export type FetchJwks = () => Promise<Jwk[]>;

let cachedKeys: { keys: Jwk[]; fetchedAt: number } | null = null;

const defaultFetchJwks: FetchJwks = async () => {
  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new Error(`JWKS fetch failed (${response.status})`);
  const body = (await response.json()) as { keys?: Jwk[] };
  return body.keys ?? [];
};

async function findKey(kid: string, fetchJwks: FetchJwks): Promise<Jwk | undefined> {
  const fresh = cachedKeys && Date.now() - cachedKeys.fetchedAt < JWKS_TTL_MS;
  let key = fresh ? cachedKeys!.keys.find((k) => k.kid === kid) : undefined;
  if (!key) {
    // Unknown kid on a warm cache usually means GitHub rotated keys.
    cachedKeys = { keys: await fetchJwks(), fetchedAt: Date.now() };
    key = cachedKeys.keys.find((k) => k.kid === kid);
  }
  return key;
}

/** Test hook: forget cached signing keys. */
export function resetJwksCache(): void {
  cachedKeys = null;
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeJson(part: string): Record<string, unknown> | null {
  try {
    return JSON.parse(new TextDecoder().decode(base64UrlDecode(part)));
  } catch {
    return null;
  }
}

export async function verifyGithubOidcToken(
  token: string,
  expected: OidcExpectations,
  fetchJwks: FetchJwks = defaultFetchJwks,
): Promise<{ ok: true; claims: Record<string, unknown> } | { ok: false; error: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Malformed token" };
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJson(headerPart);
  const claims = decodeJson(payloadPart);
  if (!header || !claims) return { ok: false, error: "Malformed token" };
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    return { ok: false, error: "Unsupported token algorithm" };
  }

  const jwk = await findKey(header.kid, fetchJwks);
  if (!jwk) return { ok: false, error: "Unknown signing key" };
  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) return { ok: false, error: "Bad signature" };

  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== GITHUB_OIDC_ISSUER) return { ok: false, error: "Wrong issuer" };
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(expected.audience)) return { ok: false, error: "Wrong audience" };
  if (typeof claims.exp !== "number" || claims.exp < now - CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "Token expired" };
  }
  if (typeof claims.nbf === "number" && claims.nbf > now + CLOCK_SKEW_SECONDS) {
    return { ok: false, error: "Token not yet valid" };
  }

  const repo = expected.repository.toLowerCase();
  const workflowRef = `${repo}/.github/workflows/${expected.workflow}@refs/heads/${expected.ref}`.toLowerCase();
  if (String(claims.repository).toLowerCase() !== repo) return { ok: false, error: "Wrong repository" };
  if (String(claims.workflow_ref).toLowerCase() !== workflowRef) return { ok: false, error: "Wrong workflow" };
  if (claims.event_name !== "workflow_dispatch") return { ok: false, error: "Wrong trigger" };

  return { ok: true, claims };
}
