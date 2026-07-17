"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";

export type FormState = { error?: string } | undefined;

export async function createTier(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const monthly = Number(formData.get("monthly_price") ?? "");
  const yearly = Number(formData.get("yearly_price") ?? "");

  if (!name) return { error: "Name is required." };
  if (!Number.isFinite(monthly) || monthly < 0) {
    return { error: "Enter a valid monthly price." };
  }
  if (!Number.isFinite(yearly) || yearly < 0) {
    return { error: "Enter a valid yearly price." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tiers").insert({
    name,
    identifier: slugify(name),
    monthly_price_cents: Math.round(monthly * 100),
    yearly_price_cents: Math.round(yearly * 100),
  });

  if (error) {
    return {
      error: error.code === "23505" ? "A tier with that name already exists." : error.message,
    };
  }

  revalidatePath("/admin/tiers");
  return undefined;
}
