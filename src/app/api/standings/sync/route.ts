import { NextResponse } from "next/server";
import { syncStandings } from "@/lib/standingsSync";
import { requireAdmin } from "@/lib/session";

// 읽기성 트리거 (Cron 등)
export async function GET() {
  try {
    const result = await syncStandings();
    return NextResponse.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/standings/sync] 예상치 못한 오류:", msg);
    return NextResponse.json({
      success: false, provider: "naver", teamCount: 0,
      message: "순위 동기화 중 오류", detail: msg, syncedAt: new Date().toISOString(),
    }, { status: 200 });
  }
}

// 관리자 수동 동기화
export async function POST() {
  try {
    await requireAdmin();
    const result = await syncStandings();
    return NextResponse.json(result);
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, message: msg }, { status: 200 });
  }
}
