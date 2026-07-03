"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import PriceChangeBadge from "@/components/PriceChangeBadge";
import TeamLogo from "@/components/TeamLogo";
import Last5Badge from "@/components/Last5Badge";
import StandingsSidebar from "@/components/StandingsSidebar";

interface Team {
  id: string; name: string; shortName: string; logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  currentPrice: number; changeRate: number; volume: number; rank: number;
  wins: number; losses: number; streak: number; last5: string; holderCount: number;
}

/* ─── 실시간 가격 셀 (플래시 애니메이션) ─── */
function LivePrice({ price, changeRate }: { price: number; changeRate: number }) {
  const prev  = useRef(price);
  const [cls, setCls] = useState("");
  useEffect(() => {
    if (price !== prev.current) {
      setCls(price > prev.current ? "animate-flash-up" : "animate-flash-down");
      prev.current = price;
      const t = setTimeout(() => setCls(""), 700);
      return () => clearTimeout(t);
    }
  }, [price]);
  return (
    <span className={cls} style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, transition: "color 0.3s" }}>
      {Math.round(price).toLocaleString()}
    </span>
  );
}

/* ─── TOP5 섹션 카드 ─── */
export default function HomePage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [tick, setTick]   = useState(0); // 자동 갱신 트리거

  const fetchTeams = () =>
    fetch("/api/teams").then(r => r.json()).then(d => Array.isArray(d) && setTeams(d)).catch(() => {});

  useEffect(() => { fetchTeams(); }, []);
  useEffect(() => {
    const iv = setInterval(() => { fetchTeams(); setTick(t => t + 1); }, 30_000);
    return () => clearInterval(iv);
  }, []);

  const topGainer = [...teams].sort((a, b) => b.changeRate - a.changeRate)[0];
  const topLoser  = [...teams].sort((a, b) => a.changeRate - b.changeRate)[0];
  const topVolume = [...teams].sort((a, b) => b.volume - a.volume)[0];

  /* ─── 비로그인: 랜딩페이지 ─── */
  if (!user) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto", paddingBottom: 80 }} className="animate-fade-in">

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #0f172a 0%, #1251aa 60%, #1e40af 100%)",
          borderRadius: 20, padding: "56px 40px", marginBottom: 32, textAlign: "center", position: "relative", overflow: "hidden"
        }}>
          <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='4'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>⚾ KBO STOCK</div>
            <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, color: "white", lineHeight: 1.15, marginBottom: 16, letterSpacing: "-0.03em" }}>
              KBO 팀에 투자하라
            </h1>
            <p style={{ fontSize: "clamp(14px, 2.5vw, 18px)", color: "rgba(255,255,255,0.75)", marginBottom: 32, lineHeight: 1.6, maxWidth: 480, margin: "0 auto 32px" }}>
              야구와 투자를 하나로.<br />KBO 10개 구단의 성적이 주가를 결정합니다.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/login">
                <div style={{ background: "white", color: "#1251aa", fontWeight: 800, fontSize: 15, padding: "14px 32px", borderRadius: 10, cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
                  🚀 지금 투자 시작하기
                </div>
              </Link>
              <Link href="/ranking">
                <div style={{ background: "rgba(255,255,255,0.12)", color: "white", fontWeight: 700, fontSize: 15, padding: "14px 28px", borderRadius: 10, cursor: "pointer", border: "1px solid rgba(255,255,255,0.25)" }}>
                  🏆 랭킹 보러가기
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* 팀 순위 */}
        <StandingsSidebar />

        {/* 서비스 소개 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 32 }}>
          {[
            { icon: "🎁", title: "시작 자산 1,000만원", desc: "가입 즉시 1,000만원 지급. 부담 없이 투자 연습" },
            { icon: "📈", title: "경기 결과가 주가를 결정", desc: "승리하면 주가 상승, 연승하면 보너스 상승" },
            { icon: "🏆", title: "랭킹 경쟁", desc: "전국 투자자들과 총 자산·수익률로 경쟁" },
            { icon: "🤖", title: "AI 투자 예측", desc: "매일 갱신되는 데이터로 팀별 투자 전망을 제공" },
          ].map(s => (
            <div key={s.icon} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 18px" }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 5 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* 시장 미리보기 */}
        {teams.length > 0 && (
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>📊 시장 현황</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>매일 경기 종료 후 자동 갱신</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["구단", "현재가", "등락률", "거래량"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: h === "구단" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.slice(0, 6).map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                      onClick={() => window.location.href = `/teams/${t.id}`}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <TeamLogo emoji={t.logoEmoji} logoUrl={t.logoUrl} color={t.colorPrimary} size={26} />
                          <span style={{ fontWeight: 600 }}>{t.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                        <LivePrice price={t.currentPrice} changeRate={t.changeRate} />원
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right" }}>
                        <PriceChangeBadge rate={t.changeRate} size="sm" animate />
                      </td>
                      <td style={{ padding: "10px 14px", textAlign: "right", color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                        {t.volume.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", textAlign: "center" }}>
              <Link href="/market" style={{ color: "#1251aa", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                전체 10개 구단 보기 →
              </Link>
            </div>
          </div>
        )}

        {/* CTA */}
        <div style={{ background: "linear-gradient(135deg,#1251aa,#1e40af)", borderRadius: 16, padding: "32px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white", marginBottom: 8 }}>지금 시작하면 1,000만원 지급!</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20 }}>야구 팬이라면 누구나. 무료로 투자를 경험하세요.</div>
          <Link href="/login">
            <div style={{ display: "inline-block", background: "white", color: "#1251aa", fontWeight: 800, fontSize: 14, padding: "12px 28px", borderRadius: 9, cursor: "pointer" }}>
              무료로 시작하기
            </div>
          </Link>
        </div>
      </div>
    );
  }

  /* ─── 로그인 후: 대시보드 ─── */
  const profitAmt   = parseInt(user.totalAsset) - 10_000_000;
  const profitColor = user.profitRate >= 0 ? "#0ab07a" : "#e53e3e";

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 80 }} className="animate-fade-in">
      {/* 인사말 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>안녕하세요, {user.nickname}님 👋</h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>오늘도 KBO STOCK에서 투자하세요</p>
      </div>



      {/* 자산 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "보유 현금", value: `${parseInt(user.cash).toLocaleString()}원`, sub: null, color: "#0f172a" },
          { label: "총 자산", value: `${parseInt(user.totalAsset).toLocaleString()}원`, sub: null, color: "#0f172a" },
          { label: "총 수익률", value: `${user.profitRate >= 0 ? "+" : ""}${(user.profitRate * 100).toFixed(2)}%`, sub: `${profitAmt >= 0 ? "+" : ""}${profitAmt.toLocaleString()}원`, color: profitColor },
        ].map(s => (
          <div key={s.label} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: s.color, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, color: s.color, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* AI 예측 바로가기 */}
      <Link href="/predictions" style={{ textDecoration: "none" }}>
        <div style={{
          background: "linear-gradient(135deg,#0f172a,#1251aa)", borderRadius: 14,
          padding: "16px 20px", marginBottom: 20, display: "flex",
          alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>🤖</span>
            <div>
              <div style={{ color: "white", fontWeight: 800, fontSize: 14 }}>AI 예측</div>
              <div style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 2 }}>매일 자동 갱신되는 데이터 기반 팀별 투자 전망을 확인하세요</div>
            </div>
          </div>
          <span style={{ color: "white", fontSize: 13, fontWeight: 700 }}>보러가기 →</span>
        </div>
      </Link>

      {/* 하이라이트 3종 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "🔥 급등", team: topGainer },
          { label: "❄️ 급락", team: topLoser },
          { label: "📦 거래량 1위", team: topVolume },
        ].map(({ label, team }) => team && (
          <Link key={label} href={`/teams/${team.id}`} style={{ textDecoration: "none" }}>
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 8 }}>{label}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TeamLogo emoji={team.logoEmoji} logoUrl={team.logoUrl} color={team.colorPrimary} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontVariantNumeric: "tabular-nums" }}>{Math.round(team.currentPrice).toLocaleString()}원</div>
                </div>
                <PriceChangeBadge rate={team.changeRate} size="sm" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 메인 레이아웃: 종목 리스트 + TOP5 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

        {/* 전체 종목 */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📊 전체 구단 시세</span>
            <Link href="/market" style={{ fontSize: 12, color: "#1251aa", textDecoration: "none", fontWeight: 600 }}>전체 →</Link>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["#", "구단", "현재가", "등락률", "최근5경기", "연속"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: h === "구단" || h === "#" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map(t => (
                  <tr key={t.id} style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                    onClick={() => window.location.href = `/teams/${t.id}`}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "10px 12px", color: "#94a3b8", fontWeight: 600, fontSize: 12, width: 28 }}>{t.rank}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <TeamLogo emoji={t.logoEmoji} logoUrl={t.logoUrl} color={t.colorPrimary} size={28} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{t.name}</div>
                          <div style={{ fontSize: 10, color: "#94a3b8" }}>{t.wins}승 {t.losses}패</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 900, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>
                      <LivePrice price={t.currentPrice} changeRate={t.changeRate} />원
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <PriceChangeBadge rate={t.changeRate} size="sm" animate />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right" }}>
                      <Last5Badge last5={t.last5} />
                    </td>
                    <td style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700 }}>
                      {t.streak > 0
                        ? <span style={{ color: "#0ab07a" }}>🔥{t.streak}연승</span>
                        : t.streak < 0
                        ? <span style={{ color: "#e53e3e" }}>❄️{Math.abs(t.streak)}연패</span>
                        : <span style={{ color: "#94a3b8" }}>—</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 우측: KBO 순위 사이드바 (수정안 7번 스펙) */}
        <div className="dashboard-side">
          <StandingsSidebar />
        </div>
      </div>
    </div>
  );
}
