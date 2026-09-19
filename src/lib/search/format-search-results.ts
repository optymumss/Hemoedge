export type SearchResultRow = { id: string; title: string };

export type FlatSearchResult = {
  id: string;
  title: string;
  type: "module" | "case";
};

export function flattenSearchResults(results: {
  modules: SearchResultRow[];
  cases: SearchResultRow[];
}): FlatSearchResult[] {
  return [
    ...results.modules.map((m) => ({ ...m, type: "module" as const })),
    ...results.cases.map((c) => ({ ...c, type: "case" as const })),
  ];
}

export function getPortalPrefix(pathname: string): "admin" | "app" {
  return pathname === "/admin" || pathname.startsWith("/admin/") ? "admin" : "app";
}

export function buildResultHref(prefix: "admin" | "app", result: FlatSearchResult): string {
  return `/${prefix}/${result.type}s/${result.id}`;
}
