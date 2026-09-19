import { describe, it, expect } from "vitest";
import { cleanNavLinks, type NavLink } from "./clean-nav-links";

describe("cleanNavLinks", () => {
  it("trims whitespace from label and href", () => {
    expect(cleanNavLinks([{ label: "  Blog  ", href: "  /blog  " }])).toEqual([
      { label: "Blog", href: "/blog" },
    ]);
  });

  it("drops a row missing a label", () => {
    expect(cleanNavLinks([{ label: "", href: "/blog" }])).toEqual([]);
  });

  it("drops a row missing an href", () => {
    expect(cleanNavLinks([{ label: "Blog", href: "" }])).toEqual([]);
  });

  it("drops a row missing both", () => {
    expect(cleanNavLinks([{ label: "", href: "" }])).toEqual([]);
  });

  it("caps output at 8 links even when given more", () => {
    const raw: NavLink[] = Array.from({ length: 10 }, (_, i) => ({
      label: `Link ${i}`,
      href: `/l${i}`,
    }));
    const result = cleanNavLinks(raw);
    expect(result).toHaveLength(8);
    expect(result[0]).toEqual({ label: "Link 0", href: "/l0" });
    expect(result[7]).toEqual({ label: "Link 7", href: "/l7" });
  });

  it("preserves order", () => {
    const raw: NavLink[] = [
      { label: "B", href: "/b" },
      { label: "A", href: "/a" },
    ];
    expect(cleanNavLinks(raw)).toEqual([
      { label: "B", href: "/b" },
      { label: "A", href: "/a" },
    ]);
  });

  it("returns an empty array for an empty input", () => {
    expect(cleanNavLinks([])).toEqual([]);
  });
});
