import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseSearchInput } from "@/lib/search/parser";
import { runSearch } from "@/lib/search/orchestrator";
import { providersFor, estimateCredits } from "@/lib/providers/registry";
import { saveReport } from "@/lib/store";
import { checkRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().min(1).max(300),
  /** "estimate" = parse + cost preview only; "execute" = run the search. */
  mode: z.enum(["estimate", "execute"]),
  /** Required for execute: the acceptable-use consent checkbox. */
  acceptedUsePolicy: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = parseSearchInput(body.query);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message, reason: parsed.reason },
      { status: 422 }
    );
  }

  if (body.mode === "estimate") {
    return NextResponse.json({
      input: parsed.input,
      providers: providersFor(parsed.input.type).map((p) => ({
        name: p.name,
        costCredits: p.costCredits,
      })),
      estimatedCredits: estimateCredits(parsed.input.type),
    });
  }

  if (!body.acceptedUsePolicy) {
    return NextResponse.json(
      { error: "You must accept the acceptable-use policy before searching." },
      { status: 403 }
    );
  }

  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const report = await runSearch(parsed.input);
  saveReport(report);

  return NextResponse.json({ reportId: report.id, totalCredits: report.totalCredits });
}
