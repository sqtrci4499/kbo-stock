import { NextRequest, NextResponse } from "next/server";
import { execute } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// 시즌 초기화 (현금 복원, 포트폴리오 삭제)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { confirm } = await req.json();
    if (confirm !== "RESET_SEASON") {
      return NextResponse.json({ error: "confirm 값이 올바르지 않습니다." }, { status: 400 });
    }

    await execute("DELETE FROM portfolios");
    await execute("DELETE FROM trades");
    await execute("DELETE FROM orders");
    await execute(
      "UPDATE users SET cash=10000000, total_asset=10000000, profit_rate=0 WHERE role='user'"
    );
    await execute("UPDATE team_stats SET holder_count=0");

    return NextResponse.json({ ok: true, message: "시즌 초기화 완료" });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
