import { CaseTabs } from "./case-tabs";

export default async function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div>
      <CaseTabs caseId={id} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
