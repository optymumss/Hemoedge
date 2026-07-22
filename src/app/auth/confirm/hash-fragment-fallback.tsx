"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function HashFragmentFallback({ next }: { next: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const access_token = hash.get("access_token");
      const refresh_token = hash.get("refresh_token");

      if (!access_token || !refresh_token) {
        if (!cancelled) setFailed(true);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (cancelled) return;
      if (error) {
        setFailed(true);
      } else {
        router.replace(next);
      }
    }

    verify();
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  if (failed) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-ink">This link has expired</h1>
        <p className="text-sm text-ink-dim">Request a new one and try again.</p>
        <Link href="/forgot-password" className="text-sm text-accent underline">
          Back to reset password
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-ink-dim">Verifying…</p>
    </main>
  );
}
