import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/org/get-current-org";
import { getOrgProgress } from "@/lib/org/get-org-progress";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const org = await getCurrentOrg();
  if (!org) {
    return NextResponse.json({ error: "No organization." }, { status: 403 });
  }

  const { members } = await getOrgProgress(org.id);

  const rows = [
    ["Name", "Email", "Attempts", "Average Score"],
    ...members.map((m) => [
      m.name,
      m.email,
      String(m.attemptCount),
      m.averageScore === null ? "" : String(m.averageScore),
    ]),
  ];

  const csv = toCsv(rows);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${org.name}-progress.csv"`,
    },
  });
}
