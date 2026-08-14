"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type FormState = { error?: string } | undefined;

const LINEAGES = ["red_cell", "white_cell", "platelet"];

export async function createCellType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const lineage = String(formData.get("lineage") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const isWbcDiffCountable = formData.get("is_wbc_diff_countable") === "on";

  if (!name || !code) return { error: "Name and code are required." };
  if (!LINEAGES.includes(lineage)) {
    return { error: "Choose a lineage." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cell_types").insert({
    name,
    code,
    slug: slugify(name),
    lineage,
    description,
    is_wbc_diff_countable: isWbcDiffCountable,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/cell-types");
  return undefined;
}

export async function updateCellType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const lineage = String(formData.get("lineage") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const isWbcDiffCountable = formData.get("is_wbc_diff_countable") === "on";

  if (!id || !name || !code) return { error: "Name and code are required." };
  if (!LINEAGES.includes(lineage)) {
    return { error: "Choose a lineage." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cell_types")
    .update({
      name,
      code,
      slug: slugify(name),
      lineage,
      description,
      is_wbc_diff_countable: isWbcDiffCountable,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/cell-types");
  return undefined;
}

export async function deleteCellType(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("cell_types").delete().eq("id", id);

  revalidatePath("/admin/cell-types");
}
