"use client";
import Link from "next/link";
import NotificationBell from "./NotificationBell";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";

const MOBILE_NAV = [
  { href: "/",            icon: "📊", label: "홈" },
  { href: "/predictions", icon: "🤖", label: "AI예측" },
  { href: "/market",      icon: "🏪", label: "시장" },
  { href: "/portfolio",   icon: "💼", label: "포폴" },
  { href: "/ranking",     icon: "🏆", label: "랭킹" },
];

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const profitColor = user
    ? user.profitRate >= 0 ? "#0ab07a" : "#e53e3e"
    : "#0f172a";

  return (
    <>
      {/* ── 데스크탑 상단바 ── */}
      <header style={{
        display: "none",
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        height: 56,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        position: "sticky",
        top: 0,
        zIndex: 40,
        gap: 16,
      }} className="md:flex">
        {/* 왼쪽: 자산 정보 */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#94a3b8" }}>현금</span>
                <span style={{ fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{parseInt(user.cash).toLocaleString()}원</span>
              </div>
              <div style={{ width: 1, height: 14, background: "#e2e8f0" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                <span style={{ color: "#94a3b8" }}>총자산</span>
                <span style={{ fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{parseInt(user.totalAsset).toLocaleString()}원</span>
              </div>
              <div style={{ width: 1, height: 14, background: "#e2e8f0" }} />
              <div style={{
                fontSize: 12, fontWeight: 700, color: profitColor,
                background: user.profitRate >= 0 ? "#ecfdf5" : "#fff5f5",
                padding: "3px 8px", borderRadius: 5, fontVariantNumeric: "tabular-nums"
              }}>
                {user.profitRate >= 0 ? "▲" : "▼"} {user.profitRate >= 0 ? "+" : ""}{(user.profitRate * 100).toFixed(2)}%
              </div>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#94a3b8" }}>로그인 후 투자 가능합니다</span>
          )}
        </div>

        {/* 오른쪽: 유저 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {user ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1251aa,#0f3f87)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700 }}>
                  {user.nickname[0]}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{user.nickname}</span>
              </div>
              <button
                onClick={handleLogout}
                style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: 5 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
                onMouseLeave={e => (e.currentTarget.style.background = "none")}
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              <Link href="/signup">
                <div style={{ border: "1.5px solid #1251aa", color: "#1251aa", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 7, cursor: "pointer" }}>
                  회원가입
                </div>
              </Link>
              <Link href="/login">
                <div style={{ background: "#1251aa", color: "white", fontSize: 13, fontWeight: 700, padding: "7px 16px", borderRadius: 7, cursor: "pointer" }}>
                  로그인
                </div>
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ── 모바일 상단 헤더 ── */}
      <header style={{
        display: "flex",
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        height: 52,
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }} className="md:hidden">
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,#1251aa,#0f3f87)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "white" }}>⚾</div>
          <span style={{ fontWeight: 900, fontSize: 14, color: "#0f172a", letterSpacing: "-0.3px" }}>KBO STOCK</span>
        </Link>
        {user ? (
          <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
            <span style={{ color: "#0f172a" }}>{user.nickname}</span>
          </div>
        ) : (
          <Link href="/login">
            <div style={{ background: "#1251aa", color: "white", fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 6 }}>로그인</div>
          </Link>
        )}
      </header>

      {/* ── 모바일 하단 네비 ── */}
      <nav style={{
        position: "fixed", bottom: 0, left: 0, right: 0,
        zIndex: 50,
        background: "white",
        borderTop: "1px solid #e2e8f0",
        display: "flex",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
      }} className="md:hidden">
        {MOBILE_NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} style={{ flex: 1, textDecoration: "none" }}>
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                padding: "8px 4px 6px",
                color: active ? "#1251aa" : "#94a3b8",
                fontSize: 10, fontWeight: active ? 700 : 500, gap: 2,
              }}>
                <span style={{ fontSize: 20, lineHeight: 1 }}>{n.icon}</span>
                {n.label}
                {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#1251aa" }} />}
              </div>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
