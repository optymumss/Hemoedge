import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-ink">This link has expired</h1>
        <p className="text-sm text-ink-dim">Request a new one and try again.</p>
        <Link href="/forgot-password" className="text-sm text-accent underline">
          Reset password
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Set a new password</h1>
        <p className="mt-1 text-sm text-ink-dim">Make it at least 8 characters.</p>
      </div>
      <ResetPasswordForm />
    </main>
  );
}
