/**
 * KBO STOCK v6 - 오늘 경기 목록
 *
 * DB에 오늘 경기가 없으면 자동으로 syncTodayGames()를 1회 실행한 뒤
 * 다시 조회하여 반환합니다 (요청서 2번 스펙).
 */

import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { syncTodayGames } from "@/lib/gameSync";

async function fetchGamesFromDb() {
  return query(`
    SELECT
      g.id,
      g.home_score           AS "homeScore",
      g.away_score           AS "awayScore",
      g.status,
      g.inning,
      g.inning_half          AS "inningHalf",
      g.stadium,
      g.game_date            AS "gameDate",
      g.game_time            AS "gameTime",
      g.start_time           AS "startTime",
      g.current_status_text  AS "currentStatusText",
      g.price_applied        AS "priceApplied",
      g.source               AS "rawSource",
      g.last_synced_at       AS "lastSyncedAt",
      g.updated_at           AS "updatedAt",
      json_build_object(
        'id', ht.id, 'name', ht.name, 'shortName', ht.short_name,
        'logoEmoji', ht.logo_emoji, 'logoUrl', ht.logo_url, 'colorPrimary', ht.color_primary
      ) AS "homeTeam",
      json_build_object(
        'id', at.id, 'name', at.name, 'shortName', at.short_name,
        'logoEmoji', at.logo_emoji, 'logoUrl', at.logo_url, 'colorPrimary', at.color_primary
      ) AS "awayTeam"
    FROM game_results g
    JOIN teams ht ON ht.id = g.home_team_id
    JOIN teams at ON at.id = g.away_team_id
    WHERE g.game_date = CURRENT_DATE
    ORDER BY
      CASE g.status
        WHEN 'live'      THEN 0
        WHEN 'scheduled' THEN 1
        WHEN 'final'     THEN 2
        ELSE 3
      END,
      g.game_time ASC NULLS LAST
  `);
}

export async function GET() {
  try {
    let games = await fetchGamesFromDb();

    // DB에 오늘 경기가 없으면 자동 동기화 1회 시도 후 재조회
    let autoSynced = false;
    let syncMessage: string | undefined;

    if (games.length === 0) {
      console.info("[GET /api/games/today] DB에 오늘 경기 없음 — 자동 동기화 시도");
      const syncResult = await syncTodayGames();
      autoSynced = true;
      syncMessage = syncResult.message;

      if (syncResult.success) {
        games = await fetchGamesFromDb();
      } else {
        console.error(`[GET /api/games/today] 자동 동기화 실패: ${syncResult.message} / ${syncResult.detail}`);
      }
    }

    return NextResponse.json({
      success: true,
      games,
      autoSynced,
      ...(syncMessage ? { syncMessage } : {}),
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[GET /api/games/today] DB 오류:", msg);
    return NextResponse.json({ success: false, games: [], message: "경기 목록 조회 실패", detail: msg }, { status: 200 });
  }
}
