/**
 * KBO STOCK v6 - 실시간 예상 주가 미리보기
 *
 * 경기가 LIVE 상태일 때, 아직 확정되지 않은 "예상 등락률"을 계산합니다.
 * 실제 주가 확정(team_prices INSERT)은 priceEngine.ts의
 * settlePricesAfterGame()이 경기 종료(FINAL) 시점에만 수행합니다.
 *
 * 이 모듈은 DB에 아무것도 쓰지 않는 순수 계산 함수만 제공하며,
 * 종목시장/경기센터 화면에 "LIVE 예상가"를 보여주는 용도로만 사용됩니다.
 */

export interface LivePreviewInput {
  homeScore: number;
  awayScore: number;
  inning:    number;   // 1~9 (연장 포함 가능)
  isHome:    boolean;  // 이 결과를 보고 싶은 팀이 홈팀인지 여부
  currentPrice: number;
}

export interface LivePreviewResult {
  expectedChangeRate: number;  // 예상 등락률 (예: 0.012 = +1.2%)
  expectedPrice:      number;  // 예상가
  isLeading:           boolean; // 현재 리드 중인지
  scoreDiff:            number; // 점수차 (절대값)
}

/**
 * 경기 진행 중 점수차/이닝 진행도를 기반으로 예상 등락률을 계산합니다.
 * 규칙 (요청서 6번):
 *   리드 중: +0.3% ~ +2% (점수차·이닝 진행도에 비례)
 *   열세:    -0.3% ~ -2%
 */
export function calculateLivePricePreview(input: LivePreviewInput): LivePreviewResult {
  const { homeScore, awayScore, inning, isHome, currentPrice } = input;

  const myScore  = isHome ? homeScore : awayScore;
  const oppScore = isHome ? awayScore : homeScore;
  const diff     = myScore - oppScore;
  const scoreDiff = Math.abs(diff);
  const isLeading = diff > 0;
  const isTied    = diff === 0;

  // 이닝 진행도 (1~9이닝을 0~1로 정규화, 9이닝 초과는 1로 클램프)
  const progress = Math.min(1, Math.max(0.1, inning / 9));

  let rate = 0;
  if (!isTied) {
    // 점수차가 클수록, 경기가 후반으로 갈수록 변동폭 확대
    const magnitude = Math.min(1, scoreDiff / 5); // 5점차 이상이면 최대치
    const base = 0.003 + magnitude * 0.017;       // 0.3% ~ 2.0%
    rate = (isLeading ? 1 : -1) * base * (0.5 + progress * 0.5);
  }

  const expectedPrice = Math.max(100, Math.round(currentPrice * (1 + rate)));

  return {
    expectedChangeRate: rate,
    expectedPrice,
    isLeading,
    scoreDiff,
  };
}

/**
 * 경기 상태(SCHEDULED/LIVE/FINAL/CANCELLED)에 따라
 * 종목시장에 "예상가"를 보여줄지 "확정가"를 보여줄지 판단하는 헬퍼.
 */
export function shouldShowLivePreview(gameStatus: string): boolean {
  return gameStatus === "LIVE" || gameStatus === "live";
}
