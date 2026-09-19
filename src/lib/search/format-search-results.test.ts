import { describe, it, expect } from "vitest";
import {
  flattenSearchResults,
  getPortalPrefix,
  buildResultHref,
  type FlatSearchResult,
} from "./format-search-results";

describe("flattenSearchResults", () => {
  it("orders modules before cases", () => {
    const result = flattenSearchResults({
      modules: [{ id: "m1", title: "Module One" }],
      cases: [{ id: "c1", title: "Case One" }],
    });
    expect(result).toEqual([
      { id: "m1", title: "Module One", type: "module" },
      { id: "c1", title: "Case One", type: "case" },
    ]);
  });

  it("returns only cases when modules is empty", () => {
    const result = flattenSearchResults({
      modules: [],
      cases: [{ id: "c1", title: "Case One" }],
    });
    expect(result).toEqual([{ id: "c1", title: "Case One", type: "case" }]);
  });

  it("returns only modules when cases is empty", () => {
    const result = flattenSearchResults({
      modules: [{ id: "m1", title: "Module One" }],
      cases: [],
    });
    expect(result).toEqual([{ id: "m1", title: "Module One", type: "module" }]);
  });

  it("returns an empty array when both are empty", () => {
    expect(flattenSearchResults({ modules: [], cases: [] })).toEqual([]);
  });
});

describe("getPortalPrefix", () => {
  it('returns "admin" for the /admin root', () => {
    expect(getPortalPrefix("/admin")).toBe("admin");
  });

  it('returns "admin" for a nested /admin path', () => {
    expect(getPortalPrefix("/admin/modules/123")).toBe("admin");
  });

  it('returns "app" for /app paths', () => {
    expect(getPortalPrefix("/app/dashboard")).toBe("app");
  });

  it('returns "app" for /org paths', () => {
    expect(getPortalPrefix("/org")).toBe("app");
  });

  it('returns "app" for the root path', () => {
    expect(getPortalPrefix("/")).toBe("app");
  });
});

describe("buildResultHref", () => {
  const moduleResult: FlatSearchResult = { id: "m1", title: "Module One", type: "module" };
  const caseResult: FlatSearchResult = { id: "c1", title: "Case One", type: "case" };

  it("builds an app-prefixed module link", () => {
    expect(buildResultHref("app", moduleResult)).toBe("/app/modules/m1");
  });

  it("builds an admin-prefixed module link", () => {
    expect(buildResultHref("admin", moduleResult)).toBe("/admin/modules/m1");
  });

  it("builds an app-prefixed case link", () => {
    expect(buildResultHref("app", caseResult)).toBe("/app/cases/c1");
  });

  it("builds an admin-prefixed case link", () => {
    expect(buildResultHref("admin", caseResult)).toBe("/admin/cases/c1");
  });
});
