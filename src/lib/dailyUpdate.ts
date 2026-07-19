/**
 * KBO STOCK v9 - 일일 업데이트 파이프라인
 *
 * 실시간 경기센터를 제거하고, 매일 한국시간 23:59에 한 번 실행되는 배치로 전환한다.
 *
 * 순서 (수정안 8번):
 *   경기 결과 저장 → 순위 갱신 → 주가 계산(경기 결과에 포함되어 자동 실행됨)
 *   → 유저 자산 재계산 → AI 예측 갱신
 *
 * 이 함수는 Vercel Cron(/api/cron/daily-update)과 관리자 수동 실행
 * (/api/admin/daily-update) 양쪽에서 공통으로 사용한다.
 */

import { execute } from "./db";
import { syncTodayGames, type SyncResult } from "./gameSync";
import { syncStandings, type StandingsSyncResult } from "./standingsSync";
import { recalcAllUserAssets, realignPricesToStandings } from "./priceEngine";
import { regenerateAiPredictions } from "./aiPrediction";

export interface DailyUpdateResult {
  success:   boolean;
  ranAt:     string;
  games:     SyncResult;
  standings: StandingsSyncResult;
  priceRealign: { count: number; skipped?: boolean };
  aiPredictions: { success: boolean; count: number; error?: string };
  message?: string;
}

export async function runDailyUpdate(): Promise<DailyUpdateResult> {
  const ranAt = new Date().toISOString();

  // 1) 경기 결과 저장 (내부적으로 신규 FINAL 경기에 대해 경기당 증분 정산까지 자동 실행됨)
  const games = await syncTodayGames();

  // 2) 팀 순위 갱신 (win_rate가 최신 상태여야 3단계 재정렬이 정확함)
  const standings = await syncStandings();

  // 3) 승률 기준 가격 재정렬 — 시드 임의가/누적 오차로 실제 순위와 어긋난 주가를 바로잡음
  //
  // 오늘 새로 확정(FINAL)된 경기가 없으면(예: 월요일 휴식일) 어떤 팀의 승률도
  // 바뀌지 않았으므로 공정가가 어제와 동일해져 changeRate가 무조건 0%가 된다.
  // 이 경우 오늘자 team_prices 행을 새로 만들지 않고 그대로 건너뛰어, 최신 행이
  // 계속 "마지막 실제 경기일"의 종가/등락률을 유지하도록 한다.
  let priceRealign: { count: number; skipped?: boolean } = { count: 0 };
  if (games.newlyFinal > 0) {
    try {
      const aligned = await realignPricesToStandings();
      priceRealign = { count: aligned.length };
    } catch (e: unknown) {
      console.error("[dailyUpdate] ⚠️ 가격 재정렬 중 오류:", e instanceof Error ? e.message : String(e));
    }
  } else {
    priceRealign = { count: 0, skipped: true };
    console.log("[dailyUpdate] ℹ️ 오늘 새로 확정된 경기가 없어 가격 재정렬을 건너뜁니다 (휴식일).");
  }

  // 4) 유저 자산(포트폴리오 평가금액) 재계산 — 재정렬된 최신 주가를 유저별 총자산에 반영
  try {
    await recalcAllUserAssets();
  } catch (e: unknown) {
    console.error("[dailyUpdate] ⚠️ 유저 자산 재계산 중 오류:", e instanceof Error ? e.message : String(e));
  }

  // 5) AI 예측 갱신 (순위/최근5경기/승률/게임차/주가변화를 반영한 새 데이터 기준)
  const aiPredictions = await regenerateAiPredictions();

  const success = games.success && standings.success && aiPredictions.success;
  const message = success
    ? `일일 업데이트 완료: 경기 ${games.syncedCount}건, 순위 ${standings.teamCount}팀, 가격정렬 ${priceRealign.count}팀, AI예측 ${aiPredictions.count}팀`
    : `일부 단계 실패: games=${games.success} standings=${standings.success} ai=${aiPredictions.success}`;

  await execute(`
    INSERT INTO daily_update_log (success, games_synced, standings_ok, ai_updated, message, detail, ran_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [
    success,
    games.syncedCount ?? 0,
    standings.success,
    aiPredictions.count ?? 0,
    message,
    JSON.stringify({ games: games.errors, standings: standings.detail, ai: aiPredictions.error }),
  ]).catch(() => {});

  return { success, ranAt, games, standings, priceRealign, aiPredictions, message };
}
