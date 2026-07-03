import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const teams = await query(`
      SELECT
        t.id,
        t.name,
        t.short_name    AS "shortName",
        t.logo_emoji    AS "logoEmoji",
        t.logo_url      AS "logoUrl",
        t.color_primary AS "colorPrimary",
        COALESCE(tp.close,        10000) AS "currentPrice",
        COALESCE(tp.change_rate,  0)     AS "changeRate",
        COALESCE(tp.volume,       0)     AS "volume",
        COALESCE(ts.rank,         99)    AS "rank",
        COALESCE(ts.wins,         0)     AS "wins",
        COALESCE(ts.losses,       0)     AS "losses",
        COALESCE(ts.draws,        0)     AS "draws",
        COALESCE(ts.win_rate,     0)     AS "winRate",
        COALESCE(ts.streak,       0)     AS "streak",
        COALESCE(ts.last5,        '')    AS "last5",
        COALESCE(ts.holder_count, 0)     AS "holderCount"
      FROM teams t
      LEFT JOIN team_stats ts
        ON ts.team_id = t.id
      LEFT JOIN LATERAL (
        SELECT close, change_rate, volume
        FROM team_prices
        WHERE team_id = t.id
        ORDER BY date DESC
        LIMIT 1
      ) tp ON true
      WHERE t.is_active = true
      ORDER BY COALESCE(ts.rank, 99)
    `);

    // 숫자 타입 명시 변환 (pg 드라이버가 FLOAT를 string으로 반환하는 경우 대비)
    const normalized = teams.map(t => ({
      ...t,
      currentPrice: Number(t.currentPrice),
      changeRate:   Number(t.changeRate),
      volume:       Number(t.volume),
      rank:         Number(t.rank),
      wins:         Number(t.wins),
      losses:       Number(t.losses),
      draws:        Number(t.draws),
      winRate:      Number(t.winRate),
      streak:       Number(t.streak),
      holderCount:  Number(t.holderCount),
    }));

    return NextResponse.json(normalized);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/teams] DB 오류:", msg);

    // 빈 배열 반환 (프론트가 Array.isArray로 체크하므로 [] 반환)
    return NextResponse.json([], { status: 200 });
  }
}
