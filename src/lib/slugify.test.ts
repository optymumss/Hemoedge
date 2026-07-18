import { describe, it, expect } from "vitest";
import { slugify } from "./slugify";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Peripheral Smear Basics")).toBe("peripheral-smear-basics");
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("A 28-year-old Woman!!  With Fatigue")).toBe(
      "a-28-year-old-woman-with-fatigue",
    );
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("  --Hello--  ")).toBe("hello");
  });

  it("returns an empty string for input with no alphanumerics", () => {
    expect(slugify("!!!")).toBe("");
  });
});
