import { NextRequest, NextResponse } from "next/server";
import { queryOne } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params;

    const team = await queryOne(`
      SELECT
        t.id,
        t.name,
        t.short_name    AS "shortName",
        t.logo_emoji    AS "logoEmoji",
        t.logo_url      AS "logoUrl",
        t.color_primary AS "colorPrimary",
        COALESCE(tp.close,       10000) AS "currentPrice",
        COALESCE(tp.change_rate, 0)     AS "changeRate",
        COALESCE(tp.volume,      0)     AS "volume",
        json_build_object(
          'rank',        COALESCE(ts.rank,         99),
          'wins',        COALESCE(ts.wins,          0),
          'losses',      COALESCE(ts.losses,        0),
          'draws',       COALESCE(ts.draws,         0),
          'winRate',     COALESCE(ts.win_rate,      0),
          'streak',      COALESCE(ts.streak,        0),
          'last5',       COALESCE(ts.last5,         ''),
          'holderCount', COALESCE(ts.holder_count,  0)
        ) AS "stats"
      FROM teams t
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      LEFT JOIN LATERAL (
        SELECT close, change_rate, volume
        FROM team_prices
        WHERE team_id = t.id
        ORDER BY date DESC
        LIMIT 1
      ) tp ON true
      WHERE t.id = $1
    `, [teamId]);

    if (!team) {
      return NextResponse.json({ error: "팀을 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(team);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/teams/:teamId] DB 오류:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
