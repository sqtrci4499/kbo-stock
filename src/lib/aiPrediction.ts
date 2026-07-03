/**
 * KBO STOCK v9 - AI 예측 엔진
 *
 * "AI"라는 이름을 쓰지만 실제로는 외부 LLM을 호출하지 않는다 — 실제 데이터(순위, 최근 5경기,
 * 승률, 연승/연패, 게임차, 최근 주가 변화, 당일 등락률)를 정해진 가중치로 조합한
 * 결정론적(deterministic) 점수 계산이다. 같은 입력이면 항상 같은 결과가 나오고,
 * 무작위(랜덤) 문구를 사용하지 않는다 (수정안 6번 요구사항).
 *
 * 점수(0~100) 산출 후 5단계 추천 등급으로 매핑하고, 가장 두드러진 요인을 골라
 * 실제 수치를 인용한 코멘트를 조립한다.
 */

import { query, execute } from "./db";

// ── 가중치 (여기서만 조정하면 전체 반영) ──────────────
// 모든 팀은 50점(중립)에서 시작해서, 각 지표가 "평균"에서 얼마나 벗어났는지에 따라
// 가감된다. 예: 승률 0.5(5할)면 0점 가감, 0.6이면 +8점, 0.4면 -8점.
const WEIGHTS = {
  winRateScale:    80, // (승률-0.5) * 80 → 승률 1.0=+40, 0.0=-40
  rankScale:       20, // (5.5-순위)/4.5 * 20 → 1위=+20, 10위=-20
  streak:           2, // 연승/연패 1경기당 ±2점
  streakClamp:      5,
  last5:            4, // 최근5경기 승수(0~5, 기준 2.5) 1당 ±4점
  gamesBehind:      1, // 게임차 1당 -1점 (선두=0점 감점, 최대 -10)
  gamesBehindClamp: 10,
  recentPriceChange: 100, // 최근 5거래일 변화율 → ±10점
  recentPriceChangeClamp: 10,
  todayChangeRate:  100, // 당일 등락률 → ±5점
  todayChangeRateClamp: 5,
};

const BASE_SCORE = 50; // 모든 팀의 시작점 (중립)

export type Recommendation = "적극 매수" | "매수" | "보유" | "관망" | "주의";

export interface TeamAiInput {
  teamId: string;
  teamName: string;
  rank: number;
  winRate: number;
  streak: number;      // 양수=연승, 음수=연패
  last5: string;        // "WWLWL" 형태
  gamesBehind: number;
  todayChangeRate: number; // 최근 종가 등락률
  recentPriceChange: number; // 최근 N거래일 누적 변화율 (0.05 = +5%)
}

export interface AiPredictionResult {
  teamId: string;
  aiScore: number;
  stars: number;
  recommendation: Recommendation;
  comment: string;
  factors: Record<string, number>;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function countWins(last5: string): number {
  return (last5.match(/W/gi) ?? []).length;
}

export function calculateAiPrediction(input: TeamAiInput): AiPredictionResult {
  const winRatePoints    = (input.winRate - 0.5) * WEIGHTS.winRateScale;
  const rankPoints        = ((5.5 - clamp(input.rank, 1, 10)) / 4.5) * WEIGHTS.rankScale;
  const streakPoints      = clamp(input.streak, -WEIGHTS.streakClamp, WEIGHTS.streakClamp) * WEIGHTS.streak;
  const last5Wins         = countWins(input.last5);
  // game_results 히스토리가 아직 5경기 미만으로 쌓인 팀은 last5가 빈 문자열이거나 짧을 수 있음.
  // 이걸 "5경기 다 패배"로 잘못 해석해 부당하게 감점하지 않도록, 데이터가 아예 없으면 중립(0점) 처리.
  const hasLast5Data      = input.last5.length > 0;
  const last5Points       = hasLast5Data ? (last5Wins - 2.5) * WEIGHTS.last5 : 0;
  const gamesBehindPoints = -clamp(input.gamesBehind, 0, WEIGHTS.gamesBehindClamp) * WEIGHTS.gamesBehind;
  const recentPricePoints = clamp(input.recentPriceChange * WEIGHTS.recentPriceChange, -WEIGHTS.recentPriceChangeClamp, WEIGHTS.recentPriceChangeClamp);
  const todayPoints       = clamp(input.todayChangeRate * WEIGHTS.todayChangeRate, -WEIGHTS.todayChangeRateClamp, WEIGHTS.todayChangeRateClamp);

  const factors = {
    winRatePoints:     Math.round(winRatePoints * 10) / 10,
    rankPoints:        Math.round(rankPoints * 10) / 10,
    streakPoints:      Math.round(streakPoints * 10) / 10,
    last5Points:       Math.round(last5Points * 10) / 10,
    gamesBehindPoints: Math.round(gamesBehindPoints * 10) / 10,
    recentPricePoints: Math.round(recentPricePoints * 10) / 10,
    todayPoints:       Math.round(todayPoints * 10) / 10,
  };

  const rawScore = BASE_SCORE
    + winRatePoints + rankPoints + streakPoints + last5Points
    + gamesBehindPoints + recentPricePoints + todayPoints;

  const aiScore = Math.round(clamp(rawScore, 0, 100));
  const stars   = clamp(Math.round(aiScore / 20), 1, 5);

  let recommendation: Recommendation;
  if (aiScore >= 80) recommendation = "적극 매수";
  else if (aiScore >= 65) recommendation = "매수";
  else if (aiScore >= 45) recommendation = "보유";
  else if (aiScore >= 30) recommendation = "관망";
  else recommendation = "주의";

  const comment = buildComment(input, recommendation, factors, last5Wins, hasLast5Data);

  return { teamId: input.teamId, aiScore, stars, recommendation, comment, factors };
}

/** 가장 두드러진 요인을 골라 실제 수치를 인용한 2~3줄 코멘트를 조립한다 (랜덤 문구 아님). */
function buildComment(
  input: TeamAiInput,
  rec: Recommendation,
  factors: Record<string, number>,
  last5Wins: number,
  hasLast5Data: boolean
): string {
  const sentences: string[] = [];

  // 1문장: 등급별 총평
  const HEADLINE: Record<Recommendation, string> = {
    "적극 매수": "최근 흐름이 매우 좋으며 추가 상승 가능성이 높습니다.",
    "매수":      "경기력과 주가 흐름이 안정적이며 단기적으로 긍정적입니다.",
    "보유":      "특별한 호재나 악재 없이 현재 흐름을 유지하고 있습니다.",
    "관망":      "최근 성적이 주춤하며 당분간 관망이 필요합니다.",
    "주의":      "연패와 순위 하락이 겹치며 신중한 접근이 필요합니다.",
  };
  sentences.push(HEADLINE[rec]);

  // 2문장: 가장 영향이 큰 긍정/부정 요인 하나씩 실제 수치로 언급
  // (최근5경기 데이터가 아직 없는 팀은 last5Wins를 근거로 쓰지 않음 — "0승"이 아니라 "데이터 없음"이므로)
  if (input.streak >= 3) {
    sentences.push(`${input.streak}연승 중으로 최근 상승세가 뚜렷합니다.`);
  } else if (input.streak <= -3) {
    sentences.push(`${Math.abs(input.streak)}연패 중으로 최근 하락 압력이 큽니다.`);
  } else if (hasLast5Data && last5Wins >= 4) {
    sentences.push(`최근 5경기 ${last5Wins}승으로 경기력이 좋습니다.`);
  } else if (hasLast5Data && last5Wins <= 1) {
    sentences.push(`최근 5경기 ${last5Wins}승에 그쳐 경기력이 아쉽습니다.`);
  } else if (input.rank <= 3) {
    sentences.push(`현재 ${input.rank}위로 상위권을 유지하고 있습니다.`);
  } else if (input.gamesBehind >= 8) {
    sentences.push(`선두와 게임차가 ${input.gamesBehind}경기로 벌어져 있습니다.`);
  }

  // 3문장: 주가 흐름
  const pricePct = (input.recentPriceChange * 100).toFixed(1);
  if (Math.abs(input.recentPriceChange) >= 0.02) {
    sentences.push(`최근 주가는 ${input.recentPriceChange >= 0 ? "+" : ""}${pricePct}% 변동했습니다.`);
  }

  return sentences.slice(0, 3).join(" ");
}

// ── 전체 팀 데이터 조회 → 계산 → DB 저장 ──────────────

interface TeamRow {
  id: string;
  name: string;
  rank: number;
  win_rate: number;
  streak: number;
  last5: string;
  games_behind: number;
}

interface PriceRow {
  team_id: string;
  close: number;
  change_rate: number;
  date: string;
}

export async function regenerateAiPredictions(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const teams = await query<TeamRow>(`
      SELECT t.id, t.name,
             COALESCE(ts.rank, 10)        AS rank,
             COALESCE(ts.win_rate, 0)     AS win_rate,
             COALESCE(ts.streak, 0)       AS streak,
             COALESCE(ts.last5, '')       AS last5,
             COALESCE(ts.games_behind, 0) AS games_behind
      FROM teams t
      LEFT JOIN team_stats ts ON ts.team_id = t.id
      WHERE t.is_active = true
    `);

    let updated = 0;

    for (const t of teams) {
      // 최근 6거래일 종가 (오늘 포함) → 5거래일 전 대비 변화율 계산
      const prices = await query<PriceRow>(`
        SELECT team_id, close, change_rate, date
        FROM team_prices
        WHERE team_id = $1
        ORDER BY date DESC
        LIMIT 6
      `, [t.id]);

      const todayChangeRate = prices[0] ? Number(prices[0].change_rate) : 0;
      const latestClose = prices[0] ? Number(prices[0].close) : null;
      const oldClose = prices.length >= 2 ? Number(prices[prices.length - 1].close) : null;
      const recentPriceChange = latestClose && oldClose && oldClose > 0
        ? (latestClose - oldClose) / oldClose
        : 0;

      const result = calculateAiPrediction({
        teamId: t.id,
        teamName: t.name,
        rank: Number(t.rank),
        winRate: Number(t.win_rate),
        streak: Number(t.streak),
        last5: t.last5,
        gamesBehind: Number(t.games_behind),
        todayChangeRate,
        recentPriceChange,
      });

      await execute(`
        INSERT INTO ai_predictions (team_id, ai_score, stars, recommendation, comment, factors, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (team_id) DO UPDATE SET
          ai_score = EXCLUDED.ai_score,
          stars = EXCLUDED.stars,
          recommendation = EXCLUDED.recommendation,
          comment = EXCLUDED.comment,
          factors = EXCLUDED.factors,
          updated_at = NOW()
      `, [result.teamId, result.aiScore, result.stars, result.recommendation, result.comment, JSON.stringify(result.factors)]);

      updated += 1;
    }

    return { success: true, count: updated };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[aiPrediction] ❌ AI 예측 재생성 실패:", msg);
    return { success: false, count: 0, error: msg };
  }
}