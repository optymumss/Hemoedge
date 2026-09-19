# Header Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shared `Header` component's static, non-functional search input and decorative "⌘K" badge with a real, role-aware search over `modules` and `cases`.

**Architecture:** A pure formatting module (`format-search-results.ts`) handles ordering, portal-prefix detection, and link-building with no I/O. A thin Supabase wrapper (`search-content.ts`) queries `modules`/`cases` via the browser client and lets existing RLS scope results per role — no new SQL functions or gating logic. A new client component (`header-search.tsx`) owns all interactive state (debounced query, dropdown, keyboard navigation) and replaces the static markup inside `header.tsx`.

**Tech Stack:** Next.js App Router (client component), Supabase browser client (`@supabase/ssr`), Vitest, Playwright (`/opt/pw-browsers/chromium`) for live verification.

## Global Constraints

- Search covers **modules and cases only** (title match) — not `cell_types` or `slide_categories`.
- No new SQL function, no `SECURITY DEFINER`, no explicit role check anywhere in this feature — rely entirely on the existing RLS policies on `modules`/`cases` (super_admin: all statuses; content_manager: published + own drafts; everyone else: published only).
- Debounce: 250ms. Minimum query length before searching: 2 characters (after `.trim()`).
- Result cap: 5 modules + 5 cases per query.
- Keyboard: ⌘K/Ctrl+K focuses the input; ArrowUp/ArrowDown move a wrapping highlight; Enter navigates to the highlighted result; Escape closes the dropdown and blurs the input; clicking outside closes without navigating.
- Link targets: `/admin/modules/[id]` and `/admin/cases/[id]` when the current path is `/admin` or under it; `/app/modules/[id]` and `/app/cases/[id]` everywhere else (covers `/app` and `/org`, since neither `member` nor `org_admin` has any other content detail route).
- A failed search query must resolve to the same empty-result UI as a genuine no-match — never an error banner.
- This does not touch the notifications bell or the Site Settings CMS — those are separate plans.

---

### Task 1: Pure formatting logic

**Files:**
- Create: `src/lib/search/format-search-results.ts`
- Test: `src/lib/search/format-search-results.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no dependencies on other tasks).
- Produces:
  - `type SearchResultRow = { id: string; title: string }`
  - `type FlatSearchResult = { id: string; title: string; type: "module" | "case" }`
  - `flattenSearchResults(results: { modules: SearchResultRow[]; cases: SearchResultRow[] }): FlatSearchResult[]`
  - `getPortalPrefix(pathname: string): "admin" | "app"`
  - `buildResultHref(prefix: "admin" | "app", result: FlatSearchResult): string`
  - Task 2 imports `SearchResultRow` from this file. Task 3 imports all three functions and `FlatSearchResult`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/search/format-search-results.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/search/format-search-results.test.ts`
Expected: FAIL — `Cannot find module './format-search-results'` (the file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/search/format-search-results.ts`:

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/search/format-search-results.test.ts`
Expected: PASS — 13/13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search/format-search-results.ts src/lib/search/format-search-results.test.ts
git commit -m "Add pure search-result formatting logic (order, portal prefix, links)"
```

---

### Task 2: Supabase search wrapper

**Files:**
- Create: `src/lib/search/search-content.ts`

**Interfaces:**
- Consumes: `SearchResultRow` from `src/lib/search/format-search-results.ts` (Task 1); `createClient` from `@/lib/supabase/client`.
- Produces:
  - `type SearchContentResult = { modules: SearchResultRow[]; cases: SearchResultRow[] }`
  - `searchContent(supabase: ReturnType<typeof createClient>, query: string): Promise<SearchContentResult>`
  - Task 3 imports `searchContent` and `SearchContentResult` from this file.

- [ ] **Step 1: Write the implementation**

Create `src/lib/search/search-content.ts`:

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

This function is not unit-tested directly (it's a thin Supabase-calling wrapper with no branching logic worth mocking — the same convention followed by `getPlatformOrgSummary` in `src/lib/admin/get-platform-summary.ts`, where only the pure aggregation function underneath got unit tests). It's proven correct via Task 4's live verification against the real database.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. If `modules`/`cases` select shapes don't match `SearchResultRow`, tsc will fail here — confirm the `id, title` column selection matches the `SearchResultRow` type exactly (both are plain `string` columns on both tables).

- [ ] **Step 3: Commit**

```bash
git add src/lib/search/search-content.ts
git commit -m "Add searchContent: exception-safe Supabase wrapper for modules/cases search"
```

---

### Task 3: HeaderSearch component and Header integration

**Files:**
- Create: `src/components/header-search.tsx`
- Modify: `src/components/header.tsx`

**Interfaces:**
- Consumes: `flattenSearchResults`, `getPortalPrefix`, `buildResultHref`, `FlatSearchResult` (Task 1); `searchContent`, `SearchContentResult` (Task 2); `createClient` from `@/lib/supabase/client`.
- Produces: `export function HeaderSearch()` — a self-contained client component with no props, rendered by `Header`.

- [ ] **Step 1: Create the component**

Create `src/components/header-search.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { searchContent, type SearchContentResult } from "@/lib/search/search-content";
import { flattenSearchResults, getPortalPrefix, buildResultHref } from "@/lib/search/format-search-results";

const EMPTY_RESULTS: SearchContentResult = { modules: [], cases: [] };
const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const prefix = getPortalPrefix(pathname);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchContentResult>(EMPTY_RESULTS);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const flatResults = useMemo(() => flattenSearchResults(results), [results]);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY_RESULTS);
      setLoading(false);
      setOpen(false);
      return;
    }

    setLoading(true);
    setOpen(true);
    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const next = await searchContent(supabase, trimmedQuery);
      setResults(next);
      setActiveIndex(0);
      setLoading(false);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery]);

  useEffect(() => {
    function handleGlobalKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function navigateTo(index: number) {
    const target = flatResults[index];
    if (!target) return;
    router.push(buildResultHref(prefix, target));
    setQuery("");
    setResults(EMPTY_RESULTS);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open || flatResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flatResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flatResults.length) % flatResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateTo(activeIndex);
    }
  }

  const showNoResults =
    open && !loading && trimmedQuery.length >= MIN_QUERY_LENGTH && flatResults.length === 0;
  const showDropdown = open && (loading || showNoResults || flatResults.length > 0);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (trimmedQuery.length >= MIN_QUERY_LENGTH) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder="Search modules, cases, or topics..."
        aria-label="Search"
        className="w-64 rounded-md border border-line-strong bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
      />
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-faint">
        ⌘K
      </span>

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-md border border-line-strong bg-surface shadow-lg">
          {loading && <p className="px-3 py-2 text-sm text-ink-dim">Searching…</p>}

          {!loading && showNoResults && (
            <p className="px-3 py-2 text-sm text-ink-dim">
              No results for &ldquo;{trimmedQuery}&rdquo;
            </p>
          )}

          {!loading &&
            flatResults.map((result, index) => {
              const previous = flatResults[index - 1];
              const showHeader = !previous || previous.type !== result.type;
              return (
                <div key={result.id}>
                  {showHeader && (
                    <p className="px-3 pt-2 text-xs uppercase text-ink-faint">
                      {result.type === "module" ? "Modules" : "Cases"}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => navigateTo(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      index === activeIndex ? "bg-surface-sunken text-ink" : "text-ink-dim"
                    }`}
                  >
                    {result.title}
                  </button>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update Header to use it**

Read `src/components/header.tsx` first to confirm current line numbers before editing (they may have shifted since this plan was written).

Replace this block (the static search `<div>` containing the `<input>` and "⌘K" `<span>`):

```tsx
        <div className="relative hidden sm:block">
          <input
            type="text"
            placeholder="Search modules, cases, or topics..."
            aria-label="Search"
            className="w-64 rounded-md border border-line-strong bg-surface-sunken px-3 py-2 text-sm text-ink placeholder:text-ink-faint"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line-strong px-1.5 py-0.5 text-[10px] text-ink-faint">
            ⌘K
          </span>
        </div>
```

with:

```tsx
        <HeaderSearch />
```

And add the import at the top of the file, alongside the existing imports:

```tsx
import { HeaderSearch } from "@/components/header-search";
```

The notifications `<button>` and `<ThemeToggle />` immediately below stay untouched.

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint src/components/header-search.tsx src/components/header.tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/header-search.tsx src/components/header.tsx
git commit -m "Wire up header search: debounced query, keyboard nav, role-scoped results"
```

---

### Task 4: Live verification

**Files:** none (throwaway verification script only, not committed)

**Interfaces:**
- Consumes: the running dev server and the real Supabase project's demo data (module/case titles below), confirmed present at spec time:
  - Published module **"Introduction to Red Blood Cell Morphology"** (created by `demo.contentmanager@optymumss.com`).
  - Draft module **"Red Cell Morphology: An Introduction"** (created by a *different* user, not `demo.contentmanager`).
  - `demo.contentmanager@optymumss.com`'s own draft module **"Demo Module: Iron Deficiency Anaemia Morphology"**, alongside a published module of the same title and a "(Rerun)" published module — all containing "Anaemia".
  - Draft case **"Test Case"** (created by `demo.contentmanager@optymumss.com`).
- Produces: nothing shipped — screenshots sent via `SendUserFile` and a pass/fail report.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)
Wait for it to report ready on its port (check with `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` until it returns `200` or a redirect).

- [ ] **Step 2: Write and run the verification script**

Write a throwaway script to `node_modules/.tmp-header-search-verify.mjs` (so Node resolves `@supabase/supabase-js`/`playwright` from the project's own `node_modules`):

```js
import { chromium } from "playwright";

const BASE_URL = "http://localhost:3000";
const PASSWORD = "HemoDemo2026!";

async function loginAs(page, email) {
  await page.goto(`${BASE_URL}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForLoadState("networkidle");
}

async function search(page, query) {
  const input = page.getByLabel("Search");
  await input.click();
  await input.fill(query);
  await page.waitForTimeout(500); // debounce (250ms) + query round-trip
}

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

// "Cell Morphology" is the substring shared by "Introduction to Red Blood
// Cell Morphology" (published) and "Red Cell Morphology: An Introduction"
// (draft, owned by a different user than demo.contentmanager) -- NOT "Red
// Cell", which is not a contiguous substring of the first title ("Red
// Blood Cell", not "Red Cell").

// 1. Learner: only published results, no cross-user drafts.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.learner@optymumss.com");
  await search(page, "Cell Morphology");
  const titles = await page.locator('button:has-text("Morphology")').allTextContents();
  console.log("learner 'Cell Morphology' results:", titles);
  if (titles.some((t) => t.includes("Red Cell Morphology: An Introduction"))) {
    throw new Error("FAIL: learner should not see another user's draft module");
  }
  if (!titles.some((t) => t.includes("Introduction to Red Blood Cell Morphology"))) {
    throw new Error("FAIL: learner should see the published module");
  }
  await page.close();
}

// 2. Content manager: sees own draft, not another user's draft.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.contentmanager@optymumss.com");
  await search(page, "Anaemia");
  const anaemiaTitles = await page.locator('button:has-text("Anaemia")').allTextContents();
  console.log("content manager 'Anaemia' results:", anaemiaTitles);
  if (!anaemiaTitles.some((t) => t.includes("Demo Module: Iron Deficiency Anaemia Morphology"))) {
    throw new Error("FAIL: content manager should see their own draft/published Anaemia modules");
  }

  await search(page, "Cell Morphology");
  const cellTitles = await page.locator('button:has-text("Morphology")').allTextContents();
  console.log("content manager 'Cell Morphology' results:", cellTitles);
  if (cellTitles.some((t) => t.includes("Red Cell Morphology: An Introduction"))) {
    throw new Error("FAIL: content manager should not see another user's draft module");
  }
  await page.close();
}

// 3. Super admin: sees everything, links resolve to /admin/...
{
  const page = await browser.newPage();
  await loginAs(page, "demo.superadmin@optymumss.com");
  await search(page, "Cell Morphology");
  const titles = await page.locator('button:has-text("Morphology")').allTextContents();
  console.log("super admin 'Cell Morphology' results:", titles);
  if (!titles.some((t) => t.includes("Red Cell Morphology: An Introduction"))) {
    throw new Error("FAIL: super admin should see every status");
  }
  await page.getByText("Red Cell Morphology: An Introduction", { exact: true }).click();
  await page.waitForTimeout(1500); // client-side nav settle (known Playwright/Next timing quirk)
  if (!page.url().includes("/admin/modules/")) {
    throw new Error(`FAIL: expected /admin/modules/ URL, got ${page.url()}`);
  }
  console.log("super admin navigated to:", page.url());
  await page.close();
}

// 4. Keyboard interaction: ⌘K focus, arrow nav (across a real 4-item
// result set: 2 published Anaemia modules + 2 published Anaemia cases,
// all visible to a learner), Enter navigates to the highlighted item.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.learner@optymumss.com");
  await page.goto(`${BASE_URL}/app`);

  await page.keyboard.down("Meta");
  await page.keyboard.press("k");
  await page.keyboard.up("Meta");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
  if (focused !== "Search") throw new Error(`FAIL: ⌘K should focus the search input, focused=${focused}`);

  await page.keyboard.type("Anaemia");
  await page.waitForTimeout(500);
  // Flattened order: [module (non-rerun), module (rerun), case (non-rerun), case (rerun)].
  // Start at index 0, ArrowDown x2 -> index 2 -> "Demo Case: Microcytic Anaemia Work-up".
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500); // client-side nav settle (known Playwright/Next timing quirk)
  if (!page.url().includes("/app/cases/2b61572f-abc9-4ba0-8922-869228b2769f")) {
    throw new Error(`FAIL: expected Enter to navigate to the 3rd flattened result, got ${page.url()}`);
  }
  console.log("arrow-key nav + Enter navigated to:", page.url());
  await page.close();
}

// 5. Escape and click-outside close the dropdown without navigating.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.learner@optymumss.com");
  await page.goto(`${BASE_URL}/app`);

  await search(page, "Anaemia");
  await page.keyboard.press("Escape");
  const dropdownVisibleAfterEscape = await page
    .locator('button:has-text("Anaemia")')
    .first()
    .isVisible()
    .catch(() => false);
  if (dropdownVisibleAfterEscape) throw new Error("FAIL: Escape should close the dropdown");

  await search(page, "Anaemia");
  await page.mouse.click(10, 10); // click outside the search box
  const dropdownVisibleAfterOutsideClick = await page
    .locator('button:has-text("Anaemia")')
    .first()
    .isVisible()
    .catch(() => false);
  if (dropdownVisibleAfterOutsideClick) throw new Error("FAIL: clicking outside should close the dropdown");
  if (!page.url().endsWith("/app")) throw new Error("FAIL: clicking outside should not navigate away");

  console.log("Escape / click-outside checks passed");
  await page.close();
}

// 6. Screenshots: light, dark, mobile.
{
  const page = await browser.newPage();
  await loginAs(page, "demo.learner@optymumss.com");
  await page.goto(`${BASE_URL}/app`);
  await search(page, "Anaemia");
  await page.screenshot({ path: "/tmp/header-search-light.png" });

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/header-search-dark.png" });
  await page.close();

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await loginAs(mobilePage, "demo.learner@optymumss.com");
  await mobilePage.goto(`${BASE_URL}/app`);
  await mobilePage.screenshot({ path: "/tmp/header-search-mobile.png" });
  await mobilePage.close();
}

await browser.close();
console.log("ALL CHECKS PASSED");
```

Run: `node --env-file=.env.local node_modules/.tmp-header-search-verify.mjs`
Expected: `ALL CHECKS PASSED` printed, no thrown errors.

- [ ] **Step 3: Send screenshots and clean up**

Send `/tmp/header-search-light.png`, `/tmp/header-search-dark.png`, and `/tmp/header-search-mobile.png` to the user via `SendUserFile`.

Delete the throwaway script:

```bash
rm node_modules/.tmp-header-search-verify.mjs
```

Stop the dev server.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: all tests pass (108 pre-existing + 13 new from Task 1 = 121/121).

---

## Final check

- [ ] `npx tsc --noEmit` clean
- [ ] `npx eslint .` clean
- [ ] `npx vitest run` — 121/121 passing
- [ ] Live verification script printed `ALL CHECKS PASSED`
- [ ] Screenshots sent to the user
