import { describe, expect, it } from "vitest";
import { getGreeting, firstName } from "./greeting";

describe("getGreeting", () => {
  it("says good morning before noon", () => {
    expect(getGreeting(new Date(2026, 0, 1, 0, 0), "Subra")).toBe("Good morning, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 11, 59), "Subra")).toBe("Good morning, Subra");
  });

  it("says good afternoon from noon up to 5pm", () => {
    expect(getGreeting(new Date(2026, 0, 1, 12, 0), "Subra")).toBe("Good afternoon, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 16, 59), "Subra")).toBe("Good afternoon, Subra");
  });

  it("says good evening from 5pm onward", () => {
    expect(getGreeting(new Date(2026, 0, 1, 17, 0), "Subra")).toBe("Good evening, Subra");
    expect(getGreeting(new Date(2026, 0, 1, 23, 59), "Subra")).toBe("Good evening, Subra");
  });
});

describe("firstName", () => {
  it("takes the first word of a full name", () => {
    expect(firstName("Subra B")).toBe("Subra");
  });

  it("returns the whole string when there's no space", () => {
    expect(firstName("Subra")).toBe("Subra");
  });

  it("returns a bare email unchanged", () => {
    expect(firstName("demo.learner@optymumss.com")).toBe("demo.learner@optymumss.com");
  });

  it("trims surrounding whitespace before splitting", () => {
    expect(firstName("  Subra B  ")).toBe("Subra");
  });
});
