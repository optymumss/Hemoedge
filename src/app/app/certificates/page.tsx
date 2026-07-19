import { createClient } from "@/lib/supabase/server";
import { getEffectiveUserId } from "@/lib/auth/impersonation";

export default async function CertificatesPage() {
  const supabase = await createClient();
  const userId = await getEffectiveUserId();

  const { data: certificates } = await supabase
    .from("certificates")
    .select("id, verification_code, issued_at, curricula(title, level)")
    .eq("user_id", userId!)
    .order("issued_at", { ascending: false });

  return (
    <div>
      <h1 className="text-xl font-semibold">Certificates</h1>
      <p className="mt-1 text-sm text-ink-dim">
        Earned by completing every module in a competency stage.
      </p>

      <div className="mt-6 flex flex-col gap-3">
        {(certificates ?? []).map((c) => (
          <div key={c.id} className="rounded-lg border border-line p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase text-ink-faint">
                  {c.curricula?.level}
                </span>
                <h2 className="font-medium">{c.curricula?.title}</h2>
              </div>
              <p className="text-xs text-ink-faint">
                {new Date(c.issued_at).toLocaleDateString()}
              </p>
            </div>
            <p className="mt-2 font-mono text-xs text-ink-dim">{c.verification_code}</p>
          </div>
        ))}
        {(certificates ?? []).length === 0 && (
          <p className="py-8 text-center text-sm text-ink-faint">
            No certificates earned yet — complete a competency stage to earn one.
          </p>
        )}
      </div>
    </div>
  );
}
