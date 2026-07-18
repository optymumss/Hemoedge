"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/send";
import { enquiryReceivedEmail } from "@/lib/email/templates";

export type FormState = { error?: string; success?: boolean } | undefined;

export async function submitEnquiry(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return { error: "Name, email, and message are all required." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("enquiries").insert({ name, email, message });

  if (error) return { error: "Something went wrong — please try again." };

  if (process.env.ENQUIRY_NOTIFY_EMAIL) {
    const { subject, html } = enquiryReceivedEmail(name, email, message);
    await sendEmail(process.env.ENQUIRY_NOTIFY_EMAIL, subject, html);
  }

  return { success: true };
}
