import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;
    const days = parseInt(new URL(req.url).searchParams.get("days") ?? "30");

    const prices = await query(`
      SELECT
        date,
        open,
        high,
        low,
        close,
        COALESCE(change_rate, 0) AS "changeRate",
        volume
      FROM team_prices
      WHERE team_id = $1
        AND date >= CURRENT_DATE - ($2 || ' days')::INTERVAL
      ORDER BY date ASC
    `, [teamId, days]);

    return NextResponse.json(prices);
  } catch (e) {
    console.error("[GET /api/teams/:teamId/prices]", e);
    return NextResponse.json({ error: "DB 조회 오류" }, { status: 500 });
  }
}
