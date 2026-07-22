import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-dim">
          Enter your email and we&apos;ll send you a link to set a new one.
        </p>
      </div>
      <ForgotPasswordForm />
      <Link href="/login" className="text-sm text-ink-dim underline">
        Back to sign in
      </Link>
    </main>
  );
}
