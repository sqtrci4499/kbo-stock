/**
 * KBO STOCK v6 - 경기 동기화 서비스
 *
 * gameProviders/ (v6 신규 구조)에서 가져온 RawGame[] 을
 * game_results 테이블에 반영하고, 새로 FINAL 상태가 된 경기는
 * 자동으로 주가를 정산 + team_stats 갱신합니다.
 *
 * 흐름:
 *   fetchTodayGames() → upsertGames() → 신규 FINAL 감지
 *   → updateTeamStatsFromGame() → settlePricesAfterGame()
 *   → SSE game_update 브로드캐스트
 *
 * 하위 호환:
 *   v5의 SyncResult 필드(totalGames, newlyFinal, usedSource 등)는
 *   그대로 유지되어 기존 관리자 페이지가 깨지지 않습니다.
 *   v6 신규 필드(provider, syncedCount, games, success)가 추가되었습니다.
 */

import { query, queryOne } from "./db";
import { fetchTodayGames, type RawGame } from "./gameProviders";
import { settlePricesAfterGame } from "./priceEngine";
import { broadcastGameUpdate } from "@/app/api/sse/route";

export interface SyncResult {
  // ── v5 호환 필드 (기존 관리자 페이지가 참조함) ──────
  totalGames: number;
  newlyFinal: number;
  settled:    Array<{ gameId: string; matchup: string; results: unknown }>;
  errors:     string[];
  usedSource: string;
  syncedAt:   string;

  // ── v6 신규 필드 (요청서 응답 스펙) ─────────────────
  success:     boolean;
  provider:    string;
  syncedCount: number;
  games:       RawGame[];
  message?:    string;
  detail?:     string;
}

// status 매핑: gameProviders(대문자) ↔ DB(소문자, 기존 체크 제약 유지)
const STATUS_DB_MAP: Record<RawGame["status"], string> = {
  SCHEDULED: "scheduled",
  LIVE:      "live",
  FINAL:     "final",
  CANCELLED: "cancelled",
};

// ── 팀 short_name → team_id 캐시 ─────────────────────
let teamIdCache: Record<string, string> | null = null;

async function getTeamIdMap(): Promise<Record<string, string>> {
  if (teamIdCache) return teamIdCache;
  const rows = await query<{ id: string; short_name: string }>(
    "SELECT id, short_name FROM teams"
  );
  teamIdCache = Object.fromEntries(rows.map(r => [r.short_name, r.id]));
  return teamIdCache;
}

// ── RawGame 1건을 game_results에 upsert ──────────────
async function upsertOneGame(
  raw: RawGame,
  teamIdMap: Record<string, string>
): Promise<{ id: string; wasFinal: boolean; becameFinal: boolean } | null> {
  const homeTeamId = teamIdMap[raw.homeTeam];
  const awayTeamId = teamIdMap[raw.awayTeam];

  if (!homeTeamId || !awayTeamId) {
    console.error(`[gameSync] ❌ 팀 매핑 실패: ${raw.homeTeam} vs ${raw.awayTeam} — 건너뜀 (KBO_TEAM_MAP 확인 필요)`);
    return null;
  }

  const existing = await queryOne<{ id: string; status: string }>(
    "SELECT id, status FROM game_results WHERE external_id = $1",
    [raw.externalId]
  );
  const wasFinal = existing?.status === "final";
  const dbStatus = STATUS_DB_MAP[raw.status];

  const winnerTeamId = raw.winnerTeam ? teamIdMap[raw.winnerTeam] ?? null : null;
  const loserTeamId  = raw.loserTeam  ? teamIdMap[raw.loserTeam]  ?? null : null;

  const row = await queryOne<{ id: string }>(`
    INSERT INTO game_results
      (home_team_id, away_team_id, home_score, away_score, game_date,
       status, stadium, inning, game_time, current_status_text,
       winner_team_id, loser_team_id, external_id, source, last_synced_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW())
    ON CONFLICT (external_id) WHERE external_id IS NOT NULL DO UPDATE SET
      home_score           = EXCLUDED.home_score,
      away_score            = EXCLUDED.away_score,
      status                 = EXCLUDED.status,
      stadium                = EXCLUDED.stadium,
      inning                 = EXCLUDED.inning,
      game_time              = EXCLUDED.game_time,
      current_status_text   = EXCLUDED.current_status_text,
      winner_team_id         = EXCLUDED.winner_team_id,
      loser_team_id          = EXCLUDED.loser_team_id,
      last_synced_at         = EXCLUDED.last_synced_at,
      updated_at              = NOW()
    RETURNING id
  `, [
    homeTeamId, awayTeamId, raw.homeScore, raw.awayScore, raw.gameDate,
    dbStatus, raw.stadium, raw.inning, raw.gameTime, raw.currentStatusText,
    winnerTeamId, loserTeamId, raw.externalId, raw.rawSource, raw.lastSyncedAt,
  ]);

  if (!row) return null;

  const becameFinal = !wasFinal && raw.status === "FINAL";
  return { id: row.id, wasFinal, becameFinal };
}

// ── team_stats 갱신 (요청서 3번: 경기 종료 시 승/패/연승연패 즉시 반영) ──
async function updateTeamStatsFromFinalGame(
  homeTeamId: string, awayTeamId: string,
  homeScore: number, awayScore: number
): Promise<void> {
  const homeWin = homeScore > awayScore;
  const isDraw  = homeScore === awayScore;

  for (const [teamId, isWin] of [
    [homeTeamId, homeWin] as const,
    [awayTeamId, !homeWin && !isDraw] as const,
  ]) {
    const stats = await queryOne<{ streak: number; wins: number; losses: number; draws: number }>(
      "SELECT streak, wins, losses, draws FROM team_stats WHERE team_id = $1", [teamId]
    );
    if (!stats) continue;

    const newStreak = isWin
      ? (stats.streak >= 0 ? stats.streak + 1 : 1)
      : isDraw ? 0
      : (stats.streak <= 0 ? stats.streak - 1 : -1);

    const newWins   = stats.wins   + (isWin ? 1 : 0);
    const newLosses = stats.losses + (!isWin && !isDraw ? 1 : 0);
    const newDraws  = stats.draws  + (isDraw ? 1 : 0);
    const total     = newWins + newLosses + newDraws;

    await query(`
      UPDATE team_stats SET
        wins = $1, losses = $2, draws = $3,
        win_rate = $4, streak = $5, updated_at = NOW()
      WHERE team_id = $6
    `, [newWins, newLosses, newDraws, total > 0 ? newWins / total : 0, newStreak, teamId]);
  }

  // 순위 재계산 (승률 기준 단순 정렬)
  await query(`
    UPDATE team_stats ts SET rank = ranked.rank
    FROM (
      SELECT team_id, ROW_NUMBER() OVER (ORDER BY win_rate DESC, wins DESC) AS rank
      FROM team_stats
    ) ranked
    WHERE ts.team_id = ranked.team_id
  `);
}

/**
 * 메인 동기화 함수
 * Provider 실패 시 명확한 에러를 errors[]/message/detail에 담아 반환합니다.
 * (Graceful Degradation: 시스템 자체는 절대 죽지 않음)
 */
export async function syncTodayGames(): Promise<SyncResult> {
  const errors: string[] = [];
  const fetchResult = await fetchTodayGames();
  const { games, provider, success, message, detail } = fetchResult;

  if (!success || games.length === 0) {
    if (message) errors.push(detail ? `${message}: ${detail}` : message);
    return {
      totalGames: 0, newlyFinal: 0, settled: [], errors,
      usedSource: provider, syncedAt: new Date().toISOString(),
      success, provider, syncedCount: 0, games: [], message, detail,
    };
  }

  const teamIdMap = await getTeamIdMap();
  const settled: SyncResult["settled"] = [];
  let newlyFinalCount = 0;
  let syncedCount = 0;

  for (const raw of games) {
    try {
      const result = await upsertOneGame(raw, teamIdMap);
      if (!result) continue;
      syncedCount += 1;

      try {
        broadcastGameUpdate({
          gameId: result.id,
          home: raw.homeTeam,
          away: raw.awayTeam,
          homeScore: raw.homeScore,
          awayScore: raw.awayScore,
          status: raw.status,
          inning: raw.inning,
          currentStatusText: raw.currentStatusText,
        });
      } catch { /* SSE 실패는 동기화 자체를 막지 않음 */ }

      if (result.becameFinal && raw.homeScore !== null && raw.awayScore !== null) {
        newlyFinalCount += 1;
        const homeTeamId = teamIdMap[raw.homeTeam];
        const awayTeamId = teamIdMap[raw.awayTeam];

        try {
          // 1) team_stats 갱신 (승/패/연승연패/순위)
          await updateTeamStatsFromFinalGame(homeTeamId, awayTeamId, raw.homeScore, raw.awayScore);

          // 2) 주가 정산
          const settleResults = await settlePricesAfterGame(result.id);
          settled.push({
            gameId: result.id,
            matchup: `${raw.homeTeam} vs ${raw.awayTeam}`,
            results: settleResults,
          });

          try {
            broadcastGameUpdate({
              gameId: result.id, type: "settled",
              matchup: `${raw.homeTeam} vs ${raw.awayTeam}`,
              results: settleResults,
            });
          } catch { /* SSE 실패 무시 */ }

        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`정산 실패 [${raw.homeTeam} vs ${raw.awayTeam}]: ${msg}`);
          console.error(`[gameSync] ❌ 정산 실패:`, msg);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`경기 처리 실패 [${raw.homeTeam} vs ${raw.awayTeam}]: ${msg}`);
      console.error(`[gameSync] ❌ 경기 upsert 실패:`, msg);
    }
  }

  return {
    totalGames: games.length,
    newlyFinal: newlyFinalCount,
    settled, errors,
    usedSource: provider,
    syncedAt: new Date().toISOString(),
    success: true, provider, syncedCount, games,
  };
}
