"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type FormState = { error?: string } | undefined;

export async function createCellType(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const lineage = String(formData.get("lineage") ?? "");

  if (!name || !code) return { error: "Name and code are required." };
  if (!["red_cell", "white_cell", "platelet"].includes(lineage)) {
    return { error: "Choose a lineage." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cell_types").insert({
    name,
    code,
    slug: slugify(name),
    lineage,
  });

  if (error) return { error: error.message };

  revalidatePath("/admin/cell-types");
  return undefined;
}
