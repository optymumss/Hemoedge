/**
 * The standard manual WBC differential categories, in reporting order.
 * Fixed (not the admin-managed `cell_types` taxonomy) — the categories a
 * haematologist counts in a 100-cell differential are a clinical
 * convention that doesn't change, so this is a code constant rather than
 * authored content. Shared by the free-tally counter (WbcCounterPanel)
 * and the Manual Diff Counter practice exercise, which both count against
 * the same fixed category set.
 */
export const WBC_CATEGORIES = [
  { code: "NEUT", label: "Neutrophils" },
  { code: "LYMPH", label: "Lymphocytes" },
  { code: "MONO", label: "Monocytes" },
  { code: "EOSINO", label: "Eosinophils" },
  { code: "BASO", label: "Basophils" },
  { code: "METAMYELO", label: "Metamyelocytes" },
  { code: "MYELO", label: "Myelocytes" },
  { code: "PROMYELO", label: "Promyelocytes" },
  { code: "BLAST", label: "Blasts" },
] as const;

/**
 * NRBCs are red cells, not white cells — a haematologist doesn't count them
 * into the 100-cell WBC differential, but reports how many were seen
 * *alongside* it, conventionally as "NRBC/100 WBCs". So it gets its own
 * tally, separate from the differential total.
 */
export const NRBC = { code: "NRBC", label: "Nucleated red cells" } as const;

export const CATEGORIES = [...WBC_CATEGORIES, NRBC];

export type CategoryCode = (typeof CATEGORIES)[number]["code"];

export const CATEGORY_LABEL: Record<CategoryCode, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.code, c.label]),
) as Record<CategoryCode, string>;

export const TARGET_COUNT = 100;

export function emptyCounts(): Record<CategoryCode, number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c.code, 0])) as Record<CategoryCode, number>;
}
