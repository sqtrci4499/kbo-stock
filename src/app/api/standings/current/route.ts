/**
 * KBO STOCK v6 - 현재 팀 순위 조회
 * DB의 team_stats를 기준으로 항상 즉시 반환합니다 (외부 호출 없음, 빠름).
 * 최신화를 원하면 /api/standings/sync 를 먼저 호출하세요.
 */

import { NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";

export async function GET() {
  try {
    const standings = await query(`
      SELECT
        t.id, t.name, t.short_name AS "shortName",
        t.logo_emoji AS "logoEmoji", t.logo_url AS "logoUrl", t.color_primary AS "colorPrimary",
        ts.rank, ts.wins, ts.losses, ts.draws,
        ts.win_rate     AS "winRate",
        ts.games_behind AS "gamesBehind",
        ts.streak, ts.last5,
        ts.updated_at   AS "updatedAt"
      FROM team_stats ts
      JOIN teams t ON t.id = ts.team_id
      ORDER BY ts.rank ASC
    `);

    const lastSyncRow = await queryOne<{ synced_at: string; provider: string }>(
      "SELECT synced_at, provider FROM standings_sync_log ORDER BY synced_at DESC LIMIT 1"
    );

    return NextResponse.json({
      success: true,
      standings,
      lastSyncedAt: lastSyncRow?.synced_at ?? null,
      lastProvider: lastSyncRow?.provider ?? null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/standings/current] DB 오류:", msg);
    return NextResponse.json({ success: false, standings: [], message: "순위 조회 실패", detail: msg }, { status: 200 });
  }
}
