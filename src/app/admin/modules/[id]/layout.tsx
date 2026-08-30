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
      <ModuleTabs moduleId={id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
