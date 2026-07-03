import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { realignPricesToStandings } from "@/lib/priceEngine";

export async function POST() {
  try {
    await requireAdmin();
    const result = await realignPricesToStandings();
    return NextResponse.json({ ok: true, count: result.length, teams: result });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
