/**
 * KBO STOCK v9 - 일일 업데이트 Cron 엔드포인트
 *
 * 매일 한국시간 23:59(UTC 14:59)에 Vercel Cron이 호출한다 (vercel.json 참고).
 * 경기결과 → 순위 → 유저자산 재계산 → AI예측 순서로 실행.
 */
import { NextRequest, NextResponse } from "next/server";
import { runDailyUpdate } from "@/lib/dailyUpdate";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await runDailyUpdate();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/cron/daily-update] 예상치 못한 오류:", msg);
    // 200으로 반환하여 Cron이 재시도 폭주하지 않도록 함 (기존 games/sync 정책과 동일)
    return NextResponse.json({ ok: false, success: false, message: msg }, { status: 200 });
  }
}
