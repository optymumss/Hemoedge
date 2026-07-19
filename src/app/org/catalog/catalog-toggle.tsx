"use client";

import { toggleCatalogSelection } from "./actions";

export function CatalogToggle({
  orgId,
  contentType,
  contentId,
  selected,
}: {
  orgId: string;
  contentType: "module" | "case" | "curriculum";
  contentId: string;
  selected: boolean;
}) {
  return (
    <form action={toggleCatalogSelection}>
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="content_type" value={contentType} />
      <input type="hidden" name="content_id" value={contentId} />
      <input type="hidden" name="selected" value={String(selected)} />
      <button
        type="submit"
        className={
          selected
            ? "rounded-md border border-line-strong px-2 py-1 text-xs text-ink-dim"
            : "rounded-md bg-accent px-2 py-1 text-xs font-medium text-accent-ink"
        }
      >
        {selected ? "Remove from catalog" : "Teach this"}
      </button>
    </form>
  );
}
