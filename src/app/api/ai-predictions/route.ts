import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const rows = await query(`
      SELECT
        t.id             AS "teamId",
        t.name,
        t.short_name     AS "shortName",
        t.logo_emoji     AS "logoEmoji",
        t.logo_url       AS "logoUrl",
        t.color_primary  AS "colorPrimary",
        COALESCE(tp.close, 10000)       AS "currentPrice",
        COALESCE(tp.change_rate, 0)     AS "changeRate",
        COALESCE(ts.rank, 99)           AS "rank",
        COALESCE(ts.wins, 0)            AS "wins",
        COALESCE(ts.losses, 0)          AS "losses",
        COALESCE(ts.win_rate, 0)        AS "winRate",
        COALESCE(ts.streak, 0)          AS "streak",
        COALESCE(ts.last5, '')          AS "last5",
        ap.ai_score      AS "aiScore",
        ap.stars         AS "stars",
        ap.recommendation AS "recommendation",
        ap.comment       AS "comment",
        ap.admin_comment AS "adminComment",
        ap.admin_comment_updated_at AS "adminCommentUpdatedAt",
        ap.updated_at    AS "updatedAt"
      FROM teams t
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      LEFT JOIN ai_predictions ap ON ap.team_id = t.id
      LEFT JOIN LATERAL (
        SELECT close, change_rate FROM team_prices
        WHERE team_id = t.id ORDER BY date DESC LIMIT 1
      ) tp ON true
      WHERE t.is_active = true
      ORDER BY ap.ai_score DESC NULLS LAST
    `);

    const normalized = rows.map((r: any) => ({
      ...r,
      currentPrice: Number(r.currentPrice),
      changeRate:   Number(r.changeRate),
      rank:         Number(r.rank),
      wins:         Number(r.wins),
      losses:       Number(r.losses),
      winRate:      Number(r.winRate),
      streak:       Number(r.streak),
      aiScore:      r.aiScore !== null ? Number(r.aiScore) : null,
      stars:        r.stars !== null ? Number(r.stars) : null,
    }));

    return NextResponse.json(normalized);
  } catch (e: unknown) {
    console.error("[GET /api/ai-predictions] DB 오류:", e instanceof Error ? e.message : String(e));
    return NextResponse.json([], { status: 200 });
  }
}
