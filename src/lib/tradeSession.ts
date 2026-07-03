/**
 * KBO STOCK - 거래 세션 관리
 * 기본: 매주 월요일 00:00 ~ 23:59 KST
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

  // 2. 기본 규칙: 월요일 (KST = UTC+9)
  const now   = new Date();
  // KST로 변환
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst   = new Date(kstMs);
  const day   = kst.getUTCDay(); // 0=일, 1=월 ...

  if (day === 1) {
    return { isOpen: true, reason: "월요일 정규 거래 시간" };
  }

  // 다음 월요일 계산
  const daysUntilMon = (8 - day) % 7 || 7;
  const nextMon      = new Date(kstMs);
  nextMon.setUTCDate(nextMon.getUTCDate() + daysUntilMon);
  nextMon.setUTCHours(0, 0, 0, 0);
  const nextMonKST   = new Date(nextMon.getTime() - 9 * 60 * 60 * 1000);

  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return {
    isOpen:  false,
    reason:  `거래는 매주 월요일에만 가능합니다. (오늘: ${dayNames[day]}요일)`,
    opensAt: nextMonKST.toISOString(),
  };
}

// ── 거래 가능 여부만 boolean으로 ─────────────────
export async function isTradeOpen(): Promise<boolean> {
  const s = await getTradeStatus();
  return s.isOpen;
}
