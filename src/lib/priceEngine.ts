/**
 * KBO STOCK - 주가 정산 엔진
 * 경기 종료 후 호출하여 두 팀의 주가를 자동 계산·저장합니다.
 */
 
import { query, queryOne } from "./db";
import { STANDINGS_ALIGNMENT } from "@/config";
 
export interface SettleResult {
  teamId:     string;
  teamName:   string;
  prevClose:  number;
  newClose:   number;
  changeRate: number;
}
 
// ── 주가 정산 메인 함수 ──────────────────────────────
export async function settlePricesAfterGame(gameId: string): Promise<SettleResult[]> {
  // 경기 조회
  const game = await queryOne<{
    id: string;
    home_id: string; home_name: string;
    away_id: string; away_name: string;
    home_score: number; away_score: number;
    price_applied: boolean;
    home_team_id: string; away_team_id: string;
  }>(`
    SELECT
      g.id,
      g.home_score, g.away_score, g.price_applied,
      ht.id   AS home_id,   ht.name AS home_name,
      at.id   AS away_id,   at.name AS away_name,
      g.home_team_id, g.away_team_id
    FROM game_results g
    JOIN teams ht ON ht.id = g.home_team_id
    JOIN teams at ON at.id = g.away_team_id
    WHERE g.id = $1
  `, [gameId]);
 
  if (!game)                          throw new Error("경기를 찾을 수 없습니다.");
  if (game.home_score === null || game.away_score === null)
                                      throw new Error("경기 점수가 입력되지 않았습니다.");
  if (game.price_applied)             throw new Error("이미 주가 정산이 완료된 경기입니다.");
 
  const homeWin   = game.home_score > game.away_score;
  const isDraw    = game.home_score === game.away_score;
  const scoreDiff = Math.abs(game.home_score - game.away_score);
 
  const outcomes = [
    { teamId: game.home_id, teamName: game.home_name, isWin: homeWin,              isDraw, isHome: true  },
    { teamId: game.away_id, teamName: game.away_name, isWin: !homeWin && !isDraw,  isDraw, isHome: false },
  ];
 
  const todayStr = new Date().toISOString().slice(0, 10);
  const results: SettleResult[] = [];
 
  for (const { teamId, teamName, isWin, isDraw, isHome } of outcomes) {
    // 팀 스탯 조회
    const stats = await queryOne<{
      streak: number; wins: number; losses: number; draws: number;
    }>("SELECT streak, wins, losses, draws FROM team_stats WHERE team_id = $1", [teamId]);
 
    // ── 주가 변동률 계산 ─────────────────────────────
    let rate = calculatePriceChange({ isWin, isDraw, isHome, scoreDiff, stats });
 
    // 유저 수급 반영 (30%)
    const volRows = await query<{ trade_type: string; vol: string }>(`
      SELECT trade_type, SUM(quantity) AS vol
      FROM trades
      WHERE team_id = $1 AND created_at >= $2::date
      GROUP BY trade_type
    `, [teamId, todayStr]);
 
    const buyVol  = Number(volRows.find(r => r.trade_type === "buy")?.vol  ?? 0);
    const sellVol = Number(volRows.find(r => r.trade_type === "sell")?.vol ?? 0);
    rate = rate * 0.70 + calcSupplyScore(buyVol, sellVol) * 0.30;
 
    // 상한 적용
    rate = Math.max(-0.15, Math.min(0.15, rate));
 
    // 이전 종가
    const latestPrice = await queryOne<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id = $1 ORDER BY date DESC LIMIT 1",
      [teamId]
    );
    const prevClose = latestPrice?.close ?? 10000;
    const newClose  = Math.max(100, Math.round(prevClose * (1 + rate)));
 
    // 오늘 주가 저장 (upsert)
    await query(`
      INSERT INTO team_prices
        (team_id, date, open, high, low, close, prev_close, change_rate, volume)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (team_id, date) DO UPDATE SET
        close       = EXCLUDED.close,
        high        = GREATEST(team_prices.high, EXCLUDED.high),
        low         = LEAST(team_prices.low,     EXCLUDED.low),
        change_rate = EXCLUDED.change_rate,
        volume      = team_prices.volume + EXCLUDED.volume
    `, [
      teamId, todayStr,
      prevClose,
      Math.max(prevClose, newClose),
      Math.min(prevClose, newClose),
      newClose, prevClose, rate,
      buyVol + sellVol,
    ]);
 
    // 팀 스탯 업데이트
    if (stats) {
      const newStreak = isWin
        ? (stats.streak >= 0 ? stats.streak + 1 : 1)
        : isDraw ? 0
        : (stats.streak <= 0 ? stats.streak - 1 : -1);
 
      const resultChar = isWin ? "W" : isDraw ? "D" : "L";
      const newLast5   = (resultChar + (stats.wins > 0 ? "" : "")).slice(0, 5); // 단순화
 
      const newWins   = stats.wins   + (isWin              ? 1 : 0);
      const newLosses = stats.losses + (!isWin && !isDraw  ? 1 : 0);
      const newDraws  = stats.draws  + (isDraw             ? 1 : 0);
      const newTotal  = newWins + newLosses + newDraws;
 
      await query(`
        UPDATE team_stats SET
          wins     = $1,
          losses   = $2,
          draws    = $3,
          win_rate = $4,
          streak   = $5,
          updated_at = NOW()
        WHERE team_id = $6
      `, [
        newWins, newLosses, newDraws,
        newTotal > 0 ? newWins / newTotal : 0,
        newStreak,
        teamId,
      ]);
    }
 
    results.push({ teamId, teamName, prevClose, newClose, changeRate: rate });
  }
 
  // 정산 완료 표시
  await query(
    "UPDATE game_results SET price_applied = true, status = 'final' WHERE id = $1",
    [gameId]
  );
 
  // 전체 유저 총 자산 재계산
  await recalcAllUserAssets();
 
  return results;
}
 
// ── 주가 변동률 계산 (순수 함수 — 단독 테스트 가능) ──
export function calculatePriceChange(params: {
  isWin:      boolean;
  isDraw:     boolean;
  isHome:     boolean;
  scoreDiff:  number;
  stats:      { streak: number } | null;
}): number {
  const { isWin, isDraw, isHome, scoreDiff, stats } = params;
  let rate = 0;
 
  // 기본 승패
  if      (isWin)   rate += 0.03;
  else if (!isDraw) rate -= 0.02;
 
  // 홈경기 보너스
  if (isWin && isHome) rate += 0.005;
 
  // 연승/연패
  if (stats) {
    if (isWin  && stats.streak > 0) rate += Math.min(stats.streak,  5) * 0.01;
    if (!isWin && !isDraw && stats.streak < 0) rate += Math.max(stats.streak, -5) * 0.01;
  }
 
  // 대량 득실점 (5점차 이상)
  if (scoreDiff >= 5) rate += isWin ? 0.015 : -0.015;
 
  return rate;
}
 
// ── 수급 점수 ─────────────────────────────────────────
function calcSupplyScore(buy: number, sell: number): number {
  const total = buy + sell;
  if (total === 0) return 0;
  return ((buy - sell) / total) * 0.10; // 최대 ±10%
}
 
// ── 전체 유저 총 자산 재계산 ────────────────────────────
export async function recalcAllUserAssets(): Promise<void> {
  // 포트폴리오 평가금 집계
  await query(`
    UPDATE users u SET
      total_asset = u.cash + COALESCE((
        SELECT SUM(p.quantity * tp.close)
        FROM portfolios p
        JOIN LATERAL (
          SELECT close FROM team_prices
          WHERE team_id = p.team_id
          ORDER BY date DESC LIMIT 1
        ) tp ON true
        WHERE p.user_id = u.id AND p.quantity > 0
      ), 0),
      profit_rate = (
        u.cash + COALESCE((
          SELECT SUM(p.quantity * tp.close)
          FROM portfolios p
          JOIN LATERAL (
            SELECT close FROM team_prices
            WHERE team_id = p.team_id
            ORDER BY date DESC LIMIT 1
          ) tp ON true
          WHERE p.user_id = u.id AND p.quantity > 0
        ), 0) - 10000000.0
      ) / 10000000.0,
      updated_at = NOW()
  `);
}
 
// ── 순위/승률 기반 가격 재정렬 (v10) ────────────────────
//
// 경기당 증분(%) 반영만 계속 쌓이면, 시드 시점의 임의 시작가나 초반 우연한
// 연승/연패 때문에 "지금 실제 순위/승률"과 주가 순서가 어긋날 수 있습니다.
// 이 함수는 각 팀의 "현재 승률" 기준 공정가를 계산해서 그 값으로 오늘자
// 종가를 다시 맞춥니다 (증분이 아니라 절대값으로 재설정).
//
// 공정가 = BASE_PRICE × (1 + (승률-0.5) × SENSITIVITY), 최저가 방어선 적용
//   예) 승률 0.625(5할2푼5리, 1위급) → 12,500원
//       승률 0.500(평균)            → 10,000원
//       승률 0.346(최하위)          →  6,920원
export interface RealignResult {
  teamId: string;
  teamName: string;
  prevClose: number;
  newClose: number;
  changeRate: number;
  winRate: number;
}
 
export async function realignPricesToStandings(): Promise<RealignResult[]> {
  const teams = await query<{
    id: string; name: string; win_rate: number;
  }>(`
    SELECT t.id, t.name, COALESCE(ts.win_rate, 0.5) AS win_rate
    FROM teams t
    LEFT JOIN team_stats ts ON ts.team_id = t.id
    WHERE t.is_active = true
  `);
 
  const today = new Date().toISOString().slice(0, 10);
  const results: RealignResult[] = [];
 
  for (const t of teams) {
    const winRate = Number(t.win_rate);
    const fairPrice = Math.max(
      STANDINGS_ALIGNMENT.MIN_PRICE,
      Math.round(STANDINGS_ALIGNMENT.BASE_PRICE * (1 + (winRate - 0.5) * STANDINGS_ALIGNMENT.SENSITIVITY))
    );
 
    // "오늘 이전"의 가장 최근 종가를 기준으로 삼는다. 단순히 "가장 최근 날짜"로 조회하면
    // 같은 날짜에 이 함수가 두 번째로 실행될 때 방금 자기가 만든 "오늘자" 행을 전날 종가로
    // 잘못 가져오게 되어 (오늘가-오늘가)/오늘가 = 0%가 되는 버그가 있었다 (실제 재현됨).
    const prev = await queryOne<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id = $1 AND date < $2 ORDER BY date DESC LIMIT 1",
      [t.id, today]
    );
    const prevClose = prev ? Number(prev.close) : fairPrice;
    const changeRate = prevClose > 0 ? (fairPrice - prevClose) / prevClose : 0;
 
    await query(`
      INSERT INTO team_prices (team_id, date, open, high, low, close, prev_close, change_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (team_id, date) DO UPDATE SET
        close = EXCLUDED.close,
        high  = GREATEST(team_prices.high, EXCLUDED.close),
        low   = LEAST(team_prices.low, EXCLUDED.close),
        change_rate = EXCLUDED.change_rate
    `, [t.id, today, prevClose, Math.max(prevClose, fairPrice), Math.min(prevClose, fairPrice), fairPrice, prevClose, changeRate]);
 
    results.push({ teamId: t.id, teamName: t.name, prevClose, newClose: fairPrice, changeRate, winRate });
  }
 
  return results;
}
 















