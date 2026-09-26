import type { TilingJobRequest } from "./parse-job-request";

/**
 * Workflow-dispatch inputs are readable by anyone who can see the (public)
 * repo's Actions runs, so the job -- including the slide's raw file URL --
 * travels as an AES-GCM sealed token only this Worker can open. The key is
 * derived from TILER_SECRET, so there is no extra secret to manage.
 */

async function sealingKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`hemoedge-tiler/job-token/v1:${secret}`),
  );
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array<ArrayBuffer> {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function sealJob(job: TilingJobRequest, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(job));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sealingKey(secret), plaintext),
  );
  const sealed = new Uint8Array(iv.length + ciphertext.length);
  sealed.set(iv);
  sealed.set(ciphertext, iv.length);
  return toBase64Url(sealed);
}

export async function openJob(token: string, secret: string): Promise<TilingJobRequest | null> {
  try {
    const sealed = fromBase64Url(token);
    if (sealed.length <= 12) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: sealed.slice(0, 12) },
      await sealingKey(secret),
      sealed.slice(12),
    );
    const job = JSON.parse(new TextDecoder().decode(plaintext)) as Partial<TilingJobRequest>;
    if (typeof job.jobId !== "string" || typeof job.slideId !== "string" || typeof job.rawFileUrl !== "string") {
      return null;
    }
    return { jobId: job.jobId, slideId: job.slideId, rawFileUrl: job.rawFileUrl };
  } catch {
    return null;
  }
}
