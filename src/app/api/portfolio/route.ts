import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireUser();

    const holdings = await query<{
      teamId: string; teamName: string; teamShortName: string;
      logoEmoji: string; logoUrl: string | null; colorPrimary: string;
      quantity: number; avgBuyPrice: number;
      currentPrice: number; changeRate: number;
    }>(`
      SELECT
        p.team_id        AS "teamId",
        t.name           AS "teamName",
        t.short_name     AS "teamShortName",
        t.logo_emoji     AS "logoEmoji",
        t.logo_url       AS "logoUrl",
        t.color_primary  AS "colorPrimary",
        p.quantity,
        p.avg_buy_price  AS "avgBuyPrice",
        COALESCE(tp.close,       0) AS "currentPrice",
        COALESCE(tp.change_rate, 0) AS "changeRate"
      FROM portfolios p
      JOIN teams t ON t.id = p.team_id
      LEFT JOIN LATERAL (
        SELECT close, change_rate
        FROM team_prices
        WHERE team_id = p.team_id
        ORDER BY date DESC
        LIMIT 1
      ) tp ON true
      WHERE p.user_id = $1 AND p.quantity > 0
      ORDER BY p.updated_at DESC
    `, [user.id]);

    const enriched = holdings.map(h => {
      const evalAmount   = h.currentPrice * h.quantity;
      const invested     = h.avgBuyPrice  * h.quantity;
      const profitAmount = evalAmount - invested;
      const profitRate   = invested > 0 ? profitAmount / invested : 0;
      return { ...h, evalAmount, profitAmount, profitRate };
    });

    const totalEval  = enriched.reduce((s, h) => s + h.evalAmount, 0);
    const cash       = Number(user.cash);
    const totalAsset = cash + totalEval;
    const profitRate = (totalAsset - 10_000_000) / 10_000_000;

    return NextResponse.json({
      cash,
      evalAsset:  totalEval,
      totalAsset,
      profitRate,
      holdings:   enriched,
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("[GET /api/portfolio]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
