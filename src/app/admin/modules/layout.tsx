import { createClient } from "@/lib/supabase/server";
import { ModulesLibraryShell } from "./modules-library-shell";

export default async function ModulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, level, status")
    .order("created_at", { ascending: false });

  return (
    <ModulesLibraryShell modules={modules ?? []}>{children}</ModulesLibraryShell>
  );
}
