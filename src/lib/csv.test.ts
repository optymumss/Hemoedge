import { describe, it, expect } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("wraps every field in quotes and joins with commas/newlines", () => {
    expect(toCsv([["Name", "Score"], ["Alice", "90"]])).toBe(
      '"Name","Score"\n"Alice","90"',
    );
  });

  it("escapes embedded double quotes by doubling them", () => {
    expect(toCsv([['She said "hi"']])).toBe('"She said ""hi"""');
  });

  it("returns an empty string for no rows", () => {
    expect(toCsv([])).toBe("");
  });
});
