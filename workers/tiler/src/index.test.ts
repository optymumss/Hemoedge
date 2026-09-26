import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GITHUB_OIDC_ISSUER, resetJwksCache } from "./github-oidc";
import worker, { OIDC_AUDIENCE } from "./index";
import { openJob, sealJob } from "./job-token";

const env = {
  TILER_SECRET: "tiler-secret",
  APP_URL: "https://app.example/",
  TILING_CALLBACK_SECRET: "callback-secret",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "akid",
  R2_SECRET_ACCESS_KEY: "sak",
  R2_BUCKET_NAME: "bucket",
  R2_PUBLIC_URL: "https://pub.example/",
  GITHUB_REPO: "optymumss/Hemoedge",
  GITHUB_WORKFLOW: "tiling.yml",
  GITHUB_REF: "main",
  GITHUB_DISPATCH_TOKEN: "gh-token",
};
const job = { jobId: "job-1", slideId: "slide-1", rawFileUrl: "https://cdn.example/raw.svs" };

let keyPair: CryptoKeyPair;
let publicJwk: JsonWebKey;

const b64url = (bytes: Uint8Array | string) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function oidcToken(overrides: Record<string, unknown> = {}, signer = keyPair.privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", kid: "k1", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: GITHUB_OIDC_ISSUER,
      aud: OIDC_AUDIENCE,
      exp: now + 300,
      nbf: now - 5,
      repository: "optymumss/Hemoedge",
      workflow_ref: "optymumss/Hemoedge/.github/workflows/tiling.yml@refs/heads/main",
      event_name: "workflow_dispatch",
      ...overrides,
    }),
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", signer, new TextEncoder().encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64url(new Uint8Array(sig))}`;
}

const fetchMock = vi.fn<typeof fetch>();

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
});

beforeEach(() => {
  resetJwksCache();
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.endsWith("/.well-known/jwks")) return Response.json({ keys: [{ ...publicJwk, kid: "k1" }] });
    if (url.startsWith("https://api.github.com/")) return new Response(null, { status: 204 });
    if (url.startsWith("https://app.example/")) return Response.json({ ok: true });
    throw new Error(`unexpected fetch ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => vi.unstubAllGlobals());

const post = (path: string, body: unknown, auth?: string) =>
  worker.fetch(
    new Request(`https://tiler.example${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) },
      body: JSON.stringify(body),
    }),
    env,
  );

describe("job tokens", () => {
  it("round-trip and hide the raw file URL", async () => {
    const token = await sealJob(job, env.TILER_SECRET);
    expect(token).not.toContain("cdn.example");
    expect(await openJob(token, env.TILER_SECRET)).toEqual(job);
  });

  it("don't open with another secret or after tampering", async () => {
    const token = await sealJob(job, env.TILER_SECRET);
    expect(await openJob(token, "other")).toBeNull();
    expect(await openJob(`${token.slice(0, -2)}AA`, env.TILER_SECRET)).toBeNull();
    expect(await openJob("garbage", env.TILER_SECRET)).toBeNull();
  });
});

describe("POST /jobs", () => {
  it("rejects a request without the tiler secret", async () => {
    expect((await post("/jobs", job)).status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("dispatches the tiling workflow with only a sealed job", async () => {
    const res = await post("/jobs", job, env.TILER_SECRET);
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ instanceId: "job-1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.github.com/repos/optymumss/Hemoedge/actions/workflows/tiling.yml/dispatches");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer gh-token");
    const sent = JSON.parse(String(init?.body));
    expect(sent.ref).toBe("main");
    expect(Object.keys(sent.inputs)).toEqual(["job"]);
    expect(String(init?.body)).not.toContain("cdn.example");
    expect(await openJob(sent.inputs.job, env.TILER_SECRET)).toEqual(job);
  });

  it("returns 502 when GitHub refuses the dispatch", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Bad credentials", { status: 401 }));
    const res = await post("/jobs", job, env.TILER_SECRET);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toMatch(/GitHub 401/);
  });
});

describe("runner routes", () => {
  it("hand R2 credentials to a genuine tiling run", async () => {
    const res = await post("/runner/start", { job: await sealJob(job, env.TILER_SECRET) }, await oidcToken());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      rawFileUrl: job.rawFileUrl,
      bucket: "bucket",
      prefix: "tiles/slide-1",
      endpoint: "https://acct.r2.cloudflarestorage.com",
      accessKeyId: "akid",
      secretAccessKey: "sak",
    });
  });

  it.each([
    ["no token", undefined],
    ["wrong repository", { repository: "someone/else" }],
    ["another workflow", { workflow_ref: "optymumss/Hemoedge/.github/workflows/ci.yml@refs/heads/main" }],
    ["another branch", { workflow_ref: "optymumss/Hemoedge/.github/workflows/tiling.yml@refs/heads/evil" }],
    ["wrong trigger", { event_name: "push" }],
    ["wrong audience", { aud: "sts.amazonaws.com" }],
    ["expired", { exp: Math.floor(Date.now() / 1000) - 3600 }],
  ])("refuse %s", async (_name, overrides) => {
    const token = overrides === undefined ? undefined : await oidcToken(overrides);
    const res = await post("/runner/start", { job: await sealJob(job, env.TILER_SECRET) }, token);
    expect(res.status).toBe(401);
  });

  it("refuse a token signed by another key", async () => {
    const other = (await crypto.subtle.generateKey(
      { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
      true,
      ["sign", "verify"],
    )) as CryptoKeyPair;
    const res = await post("/runner/start", { job: await sealJob(job, env.TILER_SECRET) }, await oidcToken({}, other.privateKey));
    expect(res.status).toBe(401);
  });

  it("refuse a job token sealed with another secret", async () => {
    const res = await post("/runner/start", { job: await sealJob(job, "other") }, await oidcToken());
    expect(res.status).toBe(400);
  });

  it("relay success to the app with ids and manifest taken from the sealed job", async () => {
    const res = await post(
      "/runner/callback",
      { job: await sealJob(job, env.TILER_SECRET), status: "ready", manifest_url: "https://evil/x.dzi" },
      await oidcToken(),
    );
    expect(res.status).toBe(200);
    const [url, init] = fetchMock.mock.calls.at(-1)!;
    expect(url).toBe("https://app.example/api/tiling/callback");
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer callback-secret");
    expect(JSON.parse(String(init?.body))).toEqual({
      job_id: "job-1",
      slide_id: "slide-1",
      status: "ready",
      manifest_url: "https://pub.example/tiles/slide-1/tiles.dzi",
    });
  });

  it("relay failures with the error text", async () => {
    await post("/runner/callback", { job: await sealJob(job, env.TILER_SECRET), status: "failed", error: "boom" }, await oidcToken());
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(JSON.parse(String(init?.body))).toEqual({ job_id: "job-1", slide_id: "slide-1", status: "failed", error: "boom" });
  });

  it("reject an unknown status", async () => {
    const res = await post("/runner/callback", { job: await sealJob(job, env.TILER_SECRET), status: "done" }, await oidcToken());
    expect(res.status).toBe(400);
  });
});

it("404s anything else", async () => {
  expect((await worker.fetch(new Request("https://tiler.example/jobs"), env)).status).toBe(404);
  expect((await post("/nope", {})).status).toBe(404);
});
