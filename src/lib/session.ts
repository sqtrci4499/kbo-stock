/**
 * KBO STOCK - 세션 관리
 * httpOnly 쿠키에 user UUID를 저장하는 단순 세션
 */

import { cookies } from "next/headers";
import { queryOne } from "./db";

export const SESSION_COOKIE = "kbo_uid";

// ── DB 유저 타입 (snake_case — PostgreSQL 컬럼명 그대로) ──
export interface DbUser {
  id:           string;
  nickname:     string;
  email:        string;
  role:         string;
  status:       string;  // active | inactive | deleted
  cash:         number;   // pg 드라이버는 BIGINT를 string으로 반환할 수 있음
  total_asset:  number;
  profit_rate:  number;
  created_at:   string;
  updated_at:   string;
}

// ── 세션 유저 조회 ────────────────────────────────────
export async function getSessionUser(): Promise<DbUser | null> {
  try {
    const cookieStore = await cookies();
    const userId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!userId) return null;

    // UUID 형식 검증 (보안)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) return null;

    const user = await queryOne<DbUser>(
      "SELECT id, nickname, email, role, status, cash, total_asset, profit_rate FROM users WHERE id = $1",
      [userId]
    );

    // 비활성/탈퇴 계정은 세션이 남아있어도 로그인 상태로 취급하지 않음
    if (!user || user.status !== "active") return null;

    return user;
  } catch {
    return null;
  }
}

// ── 인증 필수 ─────────────────────────────────────────
export async function requireUser(): Promise<DbUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

// ── 관리자 필수 ───────────────────────────────────────
export async function requireAdmin(): Promise<DbUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}

// ── 응답용 유저 객체 변환 (BigInt → string 안전 처리) ──
export function toClientUser(user: DbUser) {
  return {
    id:         user.id,
    nickname:   user.nickname,
    email:      user.email,
    role:       user.role,
    status:     user.status,
    cash:       String(user.cash),        // BIGINT → string
    totalAsset: String(user.total_asset), // BIGINT → string
    profitRate: Number(user.profit_rate),
  };
}
