/**
 * KBO STOCK - 거래 세션 관리
 * 기본: 매주 월요일 18:00 ~ 화요일 18:00 KST (24시간)
 * 관리자가 trade_sessions 테이블로 수동 오버라이드 가능
 */

import { queryOne } from "./db";

export interface TradeStatus {
  isOpen:   boolean;
  reason:   string;
  opensAt?: string;  // 다음 거래 오픈 시각 (ISO)
}

// ── 현재 거래 가능 여부 ───────────────────────────
export async function getTradeStatus(): Promise<TradeStatus> {
  // 1. DB에 활성 세션이 있으면 그것 우선
  const activeSession = await queryOne<{ open_at: string; close_at: string }>(`
    SELECT open_at, close_at
    FROM trade_sessions
    WHERE is_active = true
      AND open_at  <= NOW()
      AND close_at >= NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `).catch(() => null);

  if (activeSession) {
    return { isOpen: true, reason: "관리자 지정 거래 세션" };
  }

  // 2. 기본 규칙: 월요일 18:00 ~ 화요일 18:00 (KST = UTC+9)
  const now   = new Date();
  // KST로 변환 (kst는 "KST 벽시계 시각"을 UTC getter로 읽기 위한 트릭이며
  // 실제 UTC 타임스탬프가 아님에 유의)
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst   = new Date(kstMs);
  const day   = kst.getUTCDay();   // 0=일, 1=월, 2=화 ...
  const hour  = kst.getUTCHours(); // KST 기준 시(0~23)

  const isMondayAfter18   = day === 1 && hour >= 18;
  const isTuesdayBefore18 = day === 2 && hour < 18;

  if (isMondayAfter18 || isTuesdayBefore18) {
    return { isOpen: true, reason: "정규 거래 시간 (월 18:00 ~ 화 18:00)" };
  }

  // 다음 오픈 시각(다음 월요일 18:00 KST) 계산
  // 오늘이 월요일인데 아직 18시 전이면 -> 이번 주 월요일 18:00
  // 그 외에는 다음 주 월요일 18:00
  const daysUntilMon = day === 1 ? 0 : (8 - day) % 7 || 7;
  const nextMon      = new Date(kstMs);
  nextMon.setUTCDate(nextMon.getUTCDate() + daysUntilMon);
  nextMon.setUTCHours(18, 0, 0, 0);
  // kst 트릭으로 만든 "가짜 UTC" 시각을 실제 UTC로 되돌림
  const nextMonUTC   = new Date(nextMon.getTime() - 9 * 60 * 60 * 1000);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return {
    isOpen:  false,
    reason:  `거래는 매주 월요일 18:00 ~ 화요일 18:00에만 가능합니다. (오늘: ${dayNames[day]}요일 ${hour}시)`,
    opensAt: nextMonUTC.toISOString(),
  };
}

// ── 거래 가능 여부만 boolean으로 ─────────────────
export async function isTradeOpen(): Promise<boolean> {
  const s = await getTradeStatus();
  return s.isOpen;
}