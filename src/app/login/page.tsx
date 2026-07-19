import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-10 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold">HemoEdge</h1>
        <p className="mt-1 text-sm text-ink-dim">Sign in to continue.</p>
      </div>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
