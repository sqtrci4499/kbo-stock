"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import PriceChangeBadge from "@/components/PriceChangeBadge";

interface Holding {
  teamId: string; teamName: string; teamShortName: string;
  logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  quantity: number; avgBuyPrice: number; currentPrice: number;
  evalAmount: number; profitAmount: number; profitRate: number;
  changeRate: number;
}
interface Portfolio {
  cash: number; evalAsset: number; totalAsset: number; profitRate: number;
  holdings: Holding[];
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string | null; color?: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: color ?? "#0f172a", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: color ?? "#94a3b8", marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{sub}</div>}
    </div>
  );
}

export default function PortfolioPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading]     = useState(true);

  const fetchPortfolio = useCallback(() => {
    fetch("/api/portfolio")
      .then(r => {
        if (r.status === 401) { router.push("/login"); return null; }
        return r.json();
      })
      .then(data => { if (data) setPortfolio(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!user) { router.push("/login"); return; }
    fetchPortfolio();
  }, [user, fetchPortfolio, router]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "#94a3b8" }}>⏳ 포트폴리오 불러오는 중...</div>
  );
  if (!portfolio) return null;

  const profitAmt   = Math.round(portfolio.totalAsset - 10_000_000);
  const profitColor = portfolio.profitRate >= 0 ? "#0ab07a" : "#e53e3e";
  const profitSign  = portfolio.profitRate >= 0 ? "+" : "";

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 80 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 20 }}>💼 내 포트폴리오</h1>

      {/* 자산 요약 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
        <StatCard label="보유 현금" value={`${portfolio.cash.toLocaleString()}원`} />
        <StatCard label="평가 자산" value={`${Math.round(portfolio.evalAsset).toLocaleString()}원`} />
        <StatCard label="총 자산" value={`${Math.round(portfolio.totalAsset).toLocaleString()}원`} />
        <StatCard
          label="총 수익률"
          value={`${profitSign}${(portfolio.profitRate * 100).toFixed(2)}%`}
          sub={`${profitSign}${profitAmt.toLocaleString()}원`}
          color={profitColor}
        />
      </div>

      {/* 자산 비중 바 */}
      {portfolio.totalAsset > 0 && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 10 }}>자산 비중</div>
          <div style={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", background: "#f1f5f9" }}>
            <div style={{ width: `${(portfolio.cash / portfolio.totalAsset) * 100}%`, background: "#1251aa", transition: "width 0.5s" }} />
            <div style={{ width: `${(portfolio.evalAsset / portfolio.totalAsset) * 100}%`, background: "#0ab07a", transition: "width 0.5s" }} />
          </div>
          <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 11, color: "#64748b" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#1251aa", display: "inline-block" }} />
              현금 {((portfolio.cash / portfolio.totalAsset) * 100).toFixed(1)}%
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0ab07a", display: "inline-block" }} />
              주식 {((portfolio.evalAsset / portfolio.totalAsset) * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      {/* 보유 종목 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>보유 종목 ({portfolio.holdings.length}개)</span>
          <Link href="/market" style={{ fontSize: 12, color: "#1251aa", textDecoration: "none", fontWeight: 600 }}>종목 추가 →</Link>
        </div>

        {portfolio.holdings.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: 6 }}>보유 종목이 없습니다</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 20 }}>KBO 구단 주식을 매수해 포트폴리오를 만들어보세요</div>
            <Link href="/market">
              <div style={{ display: "inline-block", background: "#1251aa", color: "white", fontWeight: 700, fontSize: 13, padding: "10px 22px", borderRadius: 8, textDecoration: "none", cursor: "pointer" }}>
                종목 시장 보기
              </div>
            </Link>
          </div>
        ) : (
          <>
            {/* 테이블 헤더 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 110px 100px", padding: "8px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
              {["종목", "보유량", "평균단가", "평가금액", "손익"].map(h => (
                <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: h === "종목" ? "left" : "right" }}>{h}</div>
              ))}
            </div>
            {portfolio.holdings.map(h => (
              <Link key={h.teamId} href={`/teams/${h.teamId}`} style={{ textDecoration: "none", display: "block" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 110px 100px", padding: "12px 20px", alignItems: "center", borderBottom: "1px solid #f8fafc", transition: "background 0.12s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <TeamLogo emoji={h.logoEmoji} logoUrl={h.logoUrl} color={h.colorPrimary} size={36} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>{h.teamName}</div>
                      <PriceChangeBadge rate={h.changeRate} size="xs" />
                    </div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{h.quantity}주</div>
                  <div style={{ textAlign: "right", fontSize: 12, color: "#475569", fontVariantNumeric: "tabular-nums" }}>{Math.round(h.avgBuyPrice).toLocaleString()}원</div>
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{Math.round(h.evalAmount).toLocaleString()}원</div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 900, color: h.profitAmount >= 0 ? "#0ab07a" : "#e53e3e", fontVariantNumeric: "tabular-nums" }}>
                      {h.profitAmount >= 0 ? "+" : ""}{Math.round(h.profitAmount).toLocaleString()}원
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: h.profitRate >= 0 ? "#0ab07a" : "#e53e3e" }}>
                      ({h.profitRate >= 0 ? "+" : ""}{(h.profitRate * 100).toFixed(1)}%)
                    </div>
                  </div>
                </div>
              </Link>
            ))}
            {/* 합계 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 110px 100px", padding: "12px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>합계</div>
              <div />
              <div />
              <div style={{ textAlign: "right", fontSize: 13, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                {Math.round(portfolio.evalAsset).toLocaleString()}원
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: profitColor, fontVariantNumeric: "tabular-nums" }}>
                  {profitSign}{profitAmt.toLocaleString()}원
                </div>
                <div style={{ fontSize: 10, fontWeight: 600, color: profitColor }}>
                  ({profitSign}{(portfolio.profitRate * 100).toFixed(2)}%)
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
