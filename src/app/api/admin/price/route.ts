import { NextRequest, NextResponse } from "next/server";
import { execute, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { recalcAllUserAssets } from "@/lib/priceEngine";

// 관리자: 팀 주가 강제 수정
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { teamId, price, reason } = await req.json();
    if (!teamId || !price || price <= 0) {
      return NextResponse.json({ error: "teamId, price 필수" }, { status: 400 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const prev  = await queryOne<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id=$1 ORDER BY date DESC LIMIT 1", [teamId]
    );
    const prevClose  = prev?.close ?? price;
    const changeRate = (price - prevClose) / prevClose;

    await execute(`
      INSERT INTO team_prices (team_id, date, open, high, low, close, prev_close, change_rate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (team_id, date) DO UPDATE SET
        close=EXCLUDED.close, high=GREATEST(team_prices.high,EXCLUDED.close),
        low=LEAST(team_prices.low,EXCLUDED.close), change_rate=EXCLUDED.change_rate
    `, [teamId, today, prevClose, Math.max(prevClose, price), Math.min(prevClose, price),
        price, prevClose, changeRate]);

    await recalcAllUserAssets();
    return NextResponse.json({ ok: true, prevClose, newClose: price, changeRate });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
