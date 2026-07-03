/**
 * KBO STOCK - 경기 동기화 트리거
 *
 * GET  /api/games/sync         → 인증 불필요. Cron(Vercel Cron 등)이나
 *                                  브라우저에서 수동 호출 가능 (읽기성 동기화)
 * POST /api/games/sync         → 관리자 전용 강제 동기화 (관리자 페이지 버튼용)
 *
 * Vercel Cron 설정 예 (vercel.json):
 *   { "crons": [{ "path": "/api/games/sync", "schedule": "* /1 * * * *" }] }
 */

import { NextRequest, NextResponse } from "next/server";
import { syncTodayGames } from "@/lib/gameSync";
import { requireAdmin } from "@/lib/session";

// Cron 또는 외부 스케줄러용 (가벼운 보호: CRON_SECRET 헤더 선택적 검증)
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await syncTodayGames();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    // syncTodayGames 자체가 Graceful Degradation을 보장하지만
    // 혹시 모를 예외에도 시스템이 죽지 않도록 최후 방어선
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/games/sync] 예상치 못한 오류:", msg);
    return NextResponse.json({
      ok: false, totalGames: 0, newlyFinal: 0, settled: [],
      errors: [msg], usedSource: "none", syncedAt: new Date().toISOString(),
    }, { status: 200 }); // 200으로 반환하여 Cron이 재시도 폭주하지 않도록
  }
}

// 관리자 수동 동기화 (관리자 페이지 "지금 동기화" 버튼)
export async function POST() {
  try {
    await requireAdmin();
    const result = await syncTodayGames();
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, errors: [msg] }, { status: 200 });
  }
}
