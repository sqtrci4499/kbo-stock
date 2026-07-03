import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));
    const offset = (page - 1) * limit;

    const trades = await query(`
      SELECT
        tr.id,
        tr.trade_type   AS "tradeType",
        tr.price,
        tr.quantity,
        tr.total_amount AS "totalAmount",
        tr.created_at   AS "createdAt",
        t.name          AS "teamName",
        t.short_name    AS "teamShortName",
        t.logo_emoji    AS "logoEmoji",
        t.logo_url      AS "logoUrl",
        t.color_primary AS "colorPrimary"
      FROM trades tr
      JOIN teams t ON t.id = tr.team_id
      WHERE tr.user_id = $1
      ORDER BY tr.created_at DESC
      LIMIT $2 OFFSET $3
    `, [user.id, limit, offset]);

    const totalRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM trades WHERE user_id = $1",
      [user.id]
    );

    return NextResponse.json({
      trades: trades.map(t => ({
        ...t,
        totalAmount: String(t.totalAmount),
      })),
      total: parseInt(totalRow?.count ?? "0"),
      page, limit,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
