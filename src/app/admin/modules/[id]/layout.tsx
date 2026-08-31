import Link from "next/link";
import { ModuleTabs } from "./module-tabs";

export default async function ModuleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <Link href="/admin/modules" className="text-sm text-ink-dim hover:underline">
        &larr; Back to Modules
      </Link>
      <div className="mt-3">
        <ModuleTabs moduleId={id} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
