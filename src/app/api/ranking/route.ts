import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

// 랭킹은 users.total_asset(캐시된 스냅샷)을 그대로 읽지 않고, 매 요청마다
// 최신 team_prices 종가 기준으로 즉시 재계산한다. 캐시된 컬럼은 거래/정산
// 시점에만 갱신되기 때문에, 그 사이 시세가 움직이면(다른 유저 매매·경기 결과
// 등) 랭킹이 실제 보유자산(포트폴리오 화면)과 어긋나는 문제가 있었다.
const LIVE_ASSET_CTE = `
  WITH user_assets AS (
    SELECT
      u.id,
      u.nickname,
      u.cash + COALESCE((
        SELECT SUM(p.quantity * tp.close)
        FROM portfolios p
        JOIN LATERAL (
          SELECT close FROM team_prices
          WHERE team_id = p.team_id
          ORDER BY date DESC LIMIT 1
        ) tp ON true
        WHERE p.user_id = u.id AND p.quantity > 0
      ), 0) AS total_asset
    FROM users u
    WHERE u.role = 'user' AND u.status = 'active'
  )
`;

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
    const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "50"));
    const offset = (page - 1) * limit;

    const rankings = await query<{
      rank: number; userId: string; nickname: string;
      totalAsset: string; profitRate: number;
    }>(`
      ${LIVE_ASSET_CTE}
      SELECT
        ROW_NUMBER() OVER (ORDER BY total_asset DESC) AS rank,
        id           AS "userId",
        nickname,
        total_asset  AS "totalAsset",
        (total_asset - 10000000.0) / 10000000.0 AS "profitRate"
      FROM user_assets
      ORDER BY total_asset DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const totalRow = await queryOne<{ count: string }>(
      "SELECT COUNT(*) AS count FROM users WHERE role = 'user' AND status = 'active'"
    );
    const total = parseInt(totalRow?.count ?? "0");

    const me = await getSessionUser();
    let myRank: number | null = null;

    if (me && me.role === "user") {
      const myRankRow = await queryOne<{ rank: string }>(`
        ${LIVE_ASSET_CTE}
        SELECT COUNT(*) + 1 AS rank
        FROM user_assets
        WHERE total_asset > (SELECT total_asset FROM user_assets WHERE id = $1)
      `, [me.id]);
      myRank = parseInt(myRankRow?.rank ?? "1");
    }

    return NextResponse.json({
      rankings: rankings.map(r => ({
        ...r,
        rank:       Number(r.rank),
        totalAsset: String(r.totalAsset),
        profitRate: Number(r.profitRate),
        isMe:       me?.id === r.userId,
      })),
      total,
      page,
      myRank,
    });
  } catch (e) {
    console.error("[GET /api/ranking]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
