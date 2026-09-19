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
  const [lastSearchedQuery, setLastSearchedQuery] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmedQuery = query.trim();
  const queryTooShort = trimmedQuery.length < MIN_QUERY_LENGTH;
  const open = !queryTooShort && !dismissed;
  const loading = !queryTooShort && lastSearchedQuery !== trimmedQuery;

  const flatResults = useMemo(
    () => (queryTooShort ? [] : flattenSearchResults(results)),
    [results, queryTooShort],
  );

  // Fetches are the one legitimate reason for this effect to exist; every
  // setState call it makes happens inside the debounced async callback, not
  // synchronously in the effect body, so it never fights React's
  // set-state-in-effect guidance (loading/open above are derived instead of
  // separately tracked booleans this effect would otherwise have to flip).
  useEffect(() => {
    if (queryTooShort) return;

    const timeout = setTimeout(async () => {
      const supabase = createClient();
      const next = await searchContent(supabase, trimmedQuery);
      setResults(next);
      setLastSearchedQuery(trimmedQuery);
      setActiveIndex(0);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [trimmedQuery, queryTooShort]);

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
        setDismissed(true);
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
    setLastSearchedQuery(null);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setDismissed(true);
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

  const showNoResults = open && !loading && flatResults.length === 0;
  const showDropdown = open && (loading || showNoResults || flatResults.length > 0);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
        }}
        onFocus={() => {
          if (!queryTooShort) setDismissed(false);
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
