# Header Search — Design Spec

## Problem

The shared `Header` component (`src/components/header.tsx`), rendered on every screen across all three portals (`/app`, `/org`, `/admin`), has a search input reading "Search modules, cases, or topics..." with a decorative "⌘K" badge. Neither does anything: the input has no state or handler, and the keyboard shortcut isn't wired up. This spec makes it real.

## Scope

Real, functional search over **modules and cases only** (matched by title). "Topics" in the placeholder copy is not a separate data source — `cell_types` and `slide_categories` are taxonomy/reference tables, not primary content, and are out of scope for this pass.

Out of scope: the notifications bell (separate sub-project), the admin Site Settings CMS (separate sub-project).

## Access model

`modules` and `cases` already carry RLS policies (from `20260717130000_phase1_content_library.sql`) with this shape per table:
- `super_admin`: full access (all statuses)
- `content_manager`: published rows + their own draft/in_review/changes_requested rows
- everyone else (`member`, `org_admin`): published rows only

Search deliberately does **not** add a SECURITY DEFINER function or any explicit role check. It queries `modules`/`cases` directly via the browser Supabase client (same pattern already used in `src/app/admin/features/feature-form.tsx` and `src/app/org/catalog/page.tsx`), and lets existing RLS scope the rows each caller can see — the same trust boundary this codebase already relies on for every other direct `.from(...)` read.

## Components

### `src/lib/search/format-search-results.ts` (pure, unit-tested)

```ts
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
```

`flattenSearchResults` always orders modules before cases — this order is what keyboard navigation walks, and what the dropdown renders (grouped by the same order). `getPortalPrefix` matches `/admin` or any path under it; everything else (`/app/...`, `/org/...`) resolves to `app`, since `/app/modules/[id]` and `/app/cases/[id]` are the only detail routes a `member` or `org_admin` can reach.

### `src/lib/search/search-content.ts`

```ts
import { createClient } from "@/lib/supabase/client";
import type { SearchResultRow } from "./format-search-results";

type SupabaseClient = ReturnType<typeof createClient>;

const RESULT_LIMIT = 5;

export type SearchContentResult = {
  modules: SearchResultRow[];
  cases: SearchResultRow[];
};

const EMPTY_RESULT: SearchContentResult = { modules: [], cases: [] };

export async function searchContent(
  supabase: SupabaseClient,
  query: string,
): Promise<SearchContentResult> {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_RESULT;

  try {
    const [{ data: modules, error: modulesError }, { data: cases, error: casesError }] =
      await Promise.all([
        supabase
          .from("modules")
          .select("id, title")
          .ilike("title", `%${trimmed}%`)
          .order("title")
          .limit(RESULT_LIMIT),
        supabase
          .from("cases")
          .select("id, title")
          .ilike("title", `%${trimmed}%`)
          .order("title")
          .limit(RESULT_LIMIT),
      ]);

    if (modulesError || casesError) return EMPTY_RESULT;
    return { modules: modules ?? [], cases: cases ?? [] };
  } catch {
    return EMPTY_RESULT;
  }
}
```

Exception-safe: a network failure or query error yields the same empty-result state as no matches, never an error banner. This matches the existing `getPlatformOrgSummary` convention of never letting one failed data call break the surrounding UI.

### `src/components/header-search.tsx` (new, `"use client"`)

Owns all interactive state:
- `query: string`, `results: SearchContentResult`, `open: boolean`, `activeIndex: number`, `loading: boolean`
- Debounces `query` by 250ms before calling `searchContent`; queries shorter than 2 characters (after trim) never fire and close the dropdown.
- A global `keydown` listener (attached once, on mount) checks for `(e.metaKey || e.ctrlKey) && e.key === "k"`, calls `e.preventDefault()`, and focuses the input via a `ref`.
- Local `onKeyDown` on the input:
  - `ArrowDown` / `ArrowUp`: move `activeIndex` through `flattenSearchResults(results)`, wrapping at both ends.
  - `Enter`: if a result is active, `router.push(buildResultHref(prefix, active))`, then clear `query` and close.
  - `Escape`: close dropdown, blur input.
- Clicking a result: same navigate-and-clear behavior as Enter.
- Clicking outside the component (document `mousedown` listener + a wrapper `ref`) closes the dropdown without clearing the query.
- `prefix` is computed once via `getPortalPrefix(usePathname())`.
- Dropdown rendering: a "Modules" section (if any module results) then a "Cases" section (if any case results), each item highlighted when its flattened index equals `activeIndex`. While `loading`, show a single "Searching…" row. When not loading, the query is non-empty, and both result lists are empty, show "No results for “{query}”".

### `src/components/header.tsx`

Replace the static `<input>` + "⌘K" badge block with `<HeaderSearch />`. No other changes — the notifications button and `ThemeToggle` are untouched.

## Data flow

1. User types in the input → `HeaderSearch` state updates immediately (controlled input), but the network call is debounced.
2. After 250ms of no typing (and `trim().length >= 2`), `HeaderSearch` calls `searchContent(createClient(), query)` using the **browser** Supabase client (`@/lib/supabase/client`).
3. RLS on `modules`/`cases` scopes the returned rows to what the signed-in user's role permits — no extra filtering needed client-side.
4. `flattenSearchResults` produces the keyboard-navigable order; `buildResultHref` resolves each result's link using the portal prefix derived from `usePathname()`.

## Error handling

- Query failures (network, RLS-denied, etc.) resolve to `{modules: [], cases: []}` — rendered identically to a genuine no-results state. No error toast, no console spam beyond what Supabase itself logs.
- If `usePathname()` ever returns something unexpected (shouldn't happen inside the App Router), `getPortalPrefix` still returns a valid fallback (`"app"`), so a broken portal-prefix computation degrades to "link to the learner-facing page" rather than throwing.

## Testing

- Unit tests (`src/lib/search/format-search-results.test.ts`):
  - `flattenSearchResults` orders modules before cases; empty inputs on either side; both empty.
  - `getPortalPrefix`: `/admin` → `"admin"`; `/admin/modules/123` → `"admin"`; `/app/...`, `/org/...`, `/` → `"app"`.
  - `buildResultHref`: builds `/admin/modules/x`, `/app/cases/y`, etc. for both prefixes and both types.
- Live Playwright verification (throwaway script, per this engagement's established pattern):
  - As `demo.learner@optymumss.com` (member): search a known published module/case title, confirm results appear, links point to `/app/...`.
  - As `demo.contentmanager@optymumss.com`: confirm their own draft content also appears in results (not just published).
  - As `demo.superadmin@optymumss.com`: confirm links point to `/admin/...` and all statuses appear.
  - Confirm ⌘K/Ctrl+K focuses the input, ArrowDown/ArrowUp move the highlight, Enter navigates, Escape closes, and clicking outside closes without navigating.
  - Light theme, dark theme, and mobile viewport (the search input is already `hidden sm:block` on narrow screens per the existing header layout — confirm this remains true and nothing regresses).
