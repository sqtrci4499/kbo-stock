"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { href: "/",            icon: "📊", label: "홈" },
  { href: "/predictions", icon: "🤖", label: "AI 예측" },
  { href: "/market",      icon: "🏪", label: "종목 시장" },
  { href: "/portfolio",   icon: "💼", label: "내 포트폴리오" },
  { href: "/ranking",     icon: "🏆", label: "랭킹" },
  { href: "/board",       icon: "💬", label: "커뮤니티" },
  { href: "/notice",      icon: "📢", label: "공지사항" },
  { href: "/profile",     icon: "👤", label: "내 프로필" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <aside style={{
      width: 220, flexShrink: 0,
      background: "white",
      borderRight: "1px solid #e2e8f0",
      display: "flex", flexDirection: "column",
      position: "sticky", top: 0, height: "100vh",
      overflow: "hidden"
    }} className="hidden md:flex">
      {/* 로고 */}
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <Link href="/" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #1251aa, #0f3f87)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "white", fontWeight: 900
            }}>⚾</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1 }}>KBO STOCK</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>가상 구단 투자</div>
            </div>
          </div>
        </Link>
      </div>

      {/* 네비게이션 */}
      <nav style={{ flex: 1, padding: "12px 10px", overflowY: "auto" }}>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", padding: "0 8px 8px", textTransform: "uppercase" }}>메뉴</div>
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link key={n.href} href={n.href} style={{ textDecoration: "none", display: "block", marginBottom: 2 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: active ? "#1251aa" : "#475569",
                background: active ? "#eff6ff" : "transparent",
                transition: "all 0.15s",
              }}
                onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; (e.currentTarget as HTMLDivElement).style.color = "#0f172a"; }}}
                onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLDivElement).style.background = "transparent"; (e.currentTarget as HTMLDivElement).style.color = "#475569"; }}}
              >
                <span style={{ fontSize: 16 }}>{n.icon}</span>
                {n.label}
              </div>
            </Link>
          );
        })}

        {user?.role === "admin" && (
          <>
            <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.08em", padding: "16px 8px 8px", textTransform: "uppercase" }}>관리자</div>
            <Link href="/admin" style={{ textDecoration: "none", display: "block" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 12px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                color: pathname.startsWith("/admin") ? "#dc2626" : "#475569",
                background: pathname.startsWith("/admin") ? "#fff5f5" : "transparent",
              }}>
                <span style={{ fontSize: 16 }}>⚙️</span> 관리자
              </div>
            </Link>
          </>
        )}
      </nav>

      {/* 유저 정보 */}
      {user ? (
        <div style={{ margin: "0 10px 12px", padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#1251aa,#0f3f87)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 12, fontWeight: 700 }}>
              {user.nickname[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.nickname}</div>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>투자자</div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
            <span style={{ color: "#64748b" }}>보유현금</span>
            <span style={{ fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{parseInt(user.cash).toLocaleString()}원</span>
          </div>
        </div>
      ) : (
        <div style={{ margin: "0 10px 12px" }}>
          <Link href="/login" style={{ textDecoration: "none" }}>
            <div style={{ background: "#1251aa", color: "white", borderRadius: 8, padding: "9px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>
              로그인
            </div>
          </Link>
          <Link href="/signup" style={{ textDecoration: "none", display: "block", marginTop: 6 }}>
            <div style={{ border: "1.5px solid #1251aa", color: "#1251aa", borderRadius: 8, padding: "8px", textAlign: "center", fontSize: 13, fontWeight: 700 }}>
              회원가입
            </div>
          </Link>
        </div>
      )}
    </aside>
  );
}
