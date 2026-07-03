import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { recalcAllUserAssets } from "@/lib/priceEngine";

export async function POST() {
  try {
    await requireAdmin();
    await recalcAllUserAssets();
    return NextResponse.json({ ok: true, message: "전체 유저 자산 재계산 완료" });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN"))
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
