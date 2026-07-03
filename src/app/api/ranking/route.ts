import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

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
      SELECT
        ROW_NUMBER() OVER (ORDER BY total_asset DESC) AS rank,
        id         AS "userId",
        nickname,
        total_asset AS "totalAsset",
        profit_rate AS "profitRate"
      FROM users
      WHERE role = 'user' AND status = 'active'
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
        SELECT COUNT(*) + 1 AS rank
        FROM users
        WHERE role = 'user' AND status = 'active' AND total_asset > (
          SELECT total_asset FROM users WHERE id = $1
        )
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
