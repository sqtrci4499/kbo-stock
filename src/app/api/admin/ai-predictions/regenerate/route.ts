import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { regenerateAiPredictions } from "@/lib/aiPrediction";

export async function POST() {
  try {
    await requireAdmin();
    const result = await regenerateAiPredictions();
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, count: 0, error: msg }, { status: 200 });
  }
}
