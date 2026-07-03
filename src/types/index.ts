// ── 팀 ──────────────────────────────────────────
export interface Team {
  id: string;
  name: string;
  shortName: string;
  logoEmoji: string;
  colorPrimary: string;
  totalShares: number;
  isActive: boolean;
}

export interface TeamWithPrice extends Team {
  currentPrice: number;
  changeRate: number;
  volume: number;
  rank: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  streak: number;
  last5: string;
  holderCount: number;
}

export interface TeamPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changeRate: number;
  volume: number;
  timestamp?: string; // 실시간용
}

// ── 경기 ─────────────────────────────────────────
export type GameStatus =
  | "scheduled"   // 예정
  | "live"        // 진행 중
  | "final"       // 종료
  | "cancelled"   // 취소
  | "postponed";  // 연기

export interface LiveGame {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamEmoji: string;
  awayTeamEmoji: string;
  homeTeamColor: string;
  awayTeamColor: string;
  homeScore: number;
  awayScore: number;
  inning: number;
  inningHalf: "top" | "bottom"; // 초/말
  status: GameStatus;
  gameDate: string;
  startTime: string;
  stadium: string;
  priceApplied: boolean;
  // 실시간 주가 영향
  homePriceImpact: number;   // 현재 이닝 기준 영향률
  awayPriceImpact: number;
}

// ── 주가 정산 ─────────────────────────────────────
export interface SettleResult {
  teamId: string;
  teamName: string;
  prevClose: number;
  newClose: number;
  changeRate: number;
}

// ── 주가 계산 규칙 ────────────────────────────────
export interface PriceRule {
  win: number;           // 승리 기본
  loss: number;          // 패배 기본
  draw: number;          // 무승부
  streakBonus: number;   // 연승 1경기당
  streakPenalty: number; // 연패 1경기당
  maxStreak: number;     // 연승/연패 최대 반영
  blowoutWin: number;    // 대량 득점 승리 (5점차+)
  blowoutLoss: number;   // 대량 실점 패배
  blowoutThreshold: number;
  homeBonus: number;     // 홈경기 보너스
  supplyWeight: number;  // 수급 반영 비율
  maxDailyChange: number;      // 일반 시즌 상한
  maxDailyChangePostseason: number; // 포스트시즌 상한
  inningImpactScale: number;   // 실시간 이닝 영향 스케일
}

// ── 알림 ─────────────────────────────────────────
export type NotificationType =
  | "game_start"
  | "game_end"
  | "price_surge"
  | "price_drop"
  | "order_filled"
  | "season_reset";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  teamId?: string;
  teamName?: string;
  at: string;
}

// ── SSE 이벤트 ───────────────────────────────────
export type SSEEventType =
  | "price_update"
  | "game_update"
  | "ranking_update"
  | "notification"
  | "heartbeat";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  at: string;
}

// ── AI 예측 ──────────────────────────────────────
export interface AIPrediction {
  teamId: string;
  teamName: string;
  predictedChange: number;  // 예상 변동률
  upProbability: number;    // 상승 확률 0~1
  confidence: number;       // 신뢰도
  reasoning: string[];      // 근거
  generatedAt: string;
}

// ── 포트폴리오 ────────────────────────────────────
export interface Holding {
  teamId: string;
  teamName: string;
  teamShortName: string;
  logoEmoji: string;
  colorPrimary: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  evalAmount: number;
  profitAmount: number;
  profitRate: number;
  changeRate: number;
}

export interface Portfolio {
  cash: number;
  evalAsset: number;
  totalAsset: number;
  profitRate: number;
  holdings: Holding[];
}
