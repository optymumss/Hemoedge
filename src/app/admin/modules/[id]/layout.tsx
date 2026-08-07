import { createClient } from "@/lib/supabase/server";
import { ModuleTabs } from "./module-tabs";
import { ModuleInfoPanel } from "./module-info-panel";

export default async function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: module_ } = await supabase
    .from("modules")
    .select("id, title, level, status, module_type, estimated_duration_minutes, cpd_points, created_at")
    .eq("id", id)
    .single();

  if (!module_) {
    return <p className="text-sm text-ink-dim">Module not found.</p>;
  }

  return (
    <div>
      <ModuleTabs moduleId={id} />
      <div className="mt-6 flex items-start gap-6">
        <div className="min-w-0 flex-1">{children}</div>
        <ModuleInfoPanel module_={module_} />
      </div>
    </div>
  );
}
