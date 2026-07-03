"use client";
import {
  createContext, useContext, useEffect, useState,
  useCallback, ReactNode
} from "react";

// ── 클라이언트에서 사용하는 유저 타입 ─────────────────
export interface AuthUser {
  id:         string;
  nickname:   string;
  email:      string;
  role:       string;
  status:     string;
  cash:       string;  // BIGINT → string (JSON 직렬화)
  totalAsset: string;
  profitRate: number;
}

interface AuthContextType {
  user:    AuthUser | null;
  loading: boolean;
  login:   (email: string, password: string) => Promise<void>;
  logout:  () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ── Provider ──────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // 세션 확인
  const refresh = useCallback(async () => {
    try {
      const res  = await fetch("/api/auth/me", { credentials: "include" });
      const data = await res.json();
      setUser(data ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  // 마운트 시 세션 복원
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  // 로그인
  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method:      "POST",
      credentials: "include",
      headers:     { "Content-Type": "application/json" },
      body:        JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "로그인에 실패했습니다.");
    setUser(data as AuthUser);
  };

  // 로그아웃
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // 무시
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth는 AuthProvider 내부에서만 사용 가능합니다.");
  return ctx;
}
