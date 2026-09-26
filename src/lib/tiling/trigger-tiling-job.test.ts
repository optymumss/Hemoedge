import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { triggerTilingJob } from "./trigger-tiling-job";

const params = { jobId: "job-1", slideId: "slide-1", rawFileUrl: "https://cdn.example/raw.svs" };

describe("triggerTilingJob", () => {
  beforeEach(() => {
    vi.stubEnv("TILER_URL", "https://tiler.example/");
    vi.stubEnv("TILER_SECRET", "s3cret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts the job to the tiler and returns its instance id", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ instanceId: "job-1" }, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await triggerTilingJob(params);

    expect(result).toEqual({ sandboxId: "job-1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://tiler.example/jobs");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer s3cret");
    expect(JSON.parse(init.body)).toEqual(params);
  });

  it("returns a config error when TILER_URL or TILER_SECRET is missing", async () => {
    vi.stubEnv("TILER_SECRET", "");
    const result = await triggerTilingJob(params);
    expect(result.error).toMatch(/TILER_URL\/TILER_SECRET/);
  });

  it("surfaces a non-2xx tiler response as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Unauthorized" }, { status: 401 })));
    const result = await triggerTilingJob(params);
    expect(result.error).toBe("Tiler rejected the job (401): Unauthorized");
  });

  it("surfaces a network failure as an error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));
    const result = await triggerTilingJob(params);
    expect(result.error).toBe("connect ECONNREFUSED");
  });
});
