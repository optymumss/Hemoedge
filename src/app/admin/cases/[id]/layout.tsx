import Link from "next/link";
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
      <Link href="/admin/cases" className="text-sm text-ink-dim hover:underline">
        &larr; Back to Case Studies
      </Link>
      <div className="mt-3">
        <CaseTabs caseId={id} />
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
