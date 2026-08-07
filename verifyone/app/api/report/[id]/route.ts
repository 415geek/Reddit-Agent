import { NextRequest, NextResponse } from "next/server";
import { getReport } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const report = getReport(params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }
  return NextResponse.json(report);
}
