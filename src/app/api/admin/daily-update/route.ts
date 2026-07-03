/**
 * KBO STOCK v9 - 관리자 수동 "일일 업데이트 실행" 버튼용 API
 * 경기결과 → 순위 → 유저자산 재계산 → AI예측 전체 파이프라인을 즉시 실행한다.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { runDailyUpdate } from "@/lib/dailyUpdate";

export async function POST() {
  try {
    await requireAdmin();
    const result = await runDailyUpdate();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/admin/daily-update]", msg);
    return NextResponse.json({ ok: false, success: false, message: msg }, { status: 200 });
  }
}
