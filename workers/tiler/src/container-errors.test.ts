import { describe, it, expect } from "vitest";
import { containerAlreadyExited } from "./container-errors";

describe("containerAlreadyExited", () => {
  it("is true when start() saw the script finish before its first health probe", () => {
    expect(containerAlreadyExited(new Error("Container exited before we could determine the container health, exit code: 60"))).toBe(true);
    expect(containerAlreadyExited(new Error("container exited with unexpected exit code: 1"))).toBe(true);
    // a clean exit (code 0) surfaces as a rejection with no value
    expect(containerAlreadyExited(undefined)).toBe(true);
  });

  it("is false when the container never started", () => {
    expect(containerAlreadyExited(new Error("there is no container instance that can be provided to this durable object"))).toBe(false);
    expect(containerAlreadyExited(new Error("Rate limited while starting container"))).toBe(false);
    expect(containerAlreadyExited("boom")).toBe(false);
  });
});
