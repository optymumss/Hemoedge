import { describe, expect, it } from "vitest";
import { getTimeOfDayGreeting, firstName } from "./greeting";

describe("getTimeOfDayGreeting", () => {
  it("says good morning before noon", () => {
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 0, 0))).toBe("Good morning");
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 11, 59))).toBe("Good morning");
  });

  it("says good afternoon from noon up to 5pm", () => {
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 12, 0))).toBe("Good afternoon");
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 16, 59))).toBe("Good afternoon");
  });

  it("says good evening from 5pm onward", () => {
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 17, 0))).toBe("Good evening");
    expect(getTimeOfDayGreeting(new Date(2026, 0, 1, 23, 59))).toBe("Good evening");
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
