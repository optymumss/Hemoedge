import { describe, it, expect } from "vitest";
import { parseJobRequest } from "./parse-job-request";

const secret = "s3cret";
const body = { jobId: "job-1", slideId: "slide-1", rawFileUrl: "https://cdn.example/raw.svs" };

function req(init: { auth?: string; body?: unknown }) {
  return new Request("https://tiler/jobs", {
    method: "POST",
    headers: init.auth ? { Authorization: init.auth } : {},
    body: JSON.stringify(init.body ?? body),
  });
}

describe("parseJobRequest", () => {
  it("accepts a valid, authenticated request", async () => {
    const result = await parseJobRequest(req({ auth: `Bearer ${secret}` }), secret);
    expect(result).toEqual({ ok: true, job: body });
  });

  it("rejects a missing or wrong bearer token with 401", async () => {
    expect(await parseJobRequest(req({}), secret)).toMatchObject({ ok: false, status: 401 });
    expect(await parseJobRequest(req({ auth: "Bearer nope" }), secret)).toMatchObject({ ok: false, status: 401 });
  });

  it("rejects a body missing fields with 400", async () => {
    const result = await parseJobRequest(req({ auth: `Bearer ${secret}`, body: { jobId: "j" } }), secret);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it("rejects a non-https rawFileUrl with 400", async () => {
    const result = await parseJobRequest(
      req({ auth: `Bearer ${secret}`, body: { ...body, rawFileUrl: "file:///etc/passwd" } }),
      secret,
    );
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});
