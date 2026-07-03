"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import PriceChangeBadge from "@/components/PriceChangeBadge";
import Last5Badge from "@/components/Last5Badge";
import TeamLogo from "@/components/TeamLogo";
import BuySellPanel from "@/components/BuySellPanel";
import PriceChart from "@/components/PriceChart";

interface TeamDetail {
  id: string; name: string; shortName: string; logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  currentPrice: number; changeRate: number; volume: number;
  stats: { rank: number; wins: number; losses: number; draws: number; winRate: number; streak: number; last5: string; holderCount: number; } | null;
}
interface Holding { teamId: string; quantity: number; avgBuyPrice: number; }

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const [team, setTeam]       = useState<TeamDetail | null>(null);
  const [holding, setHolding] = useState<Holding | null>(null);
  const [loading, setLoading] = useState(true);
  const prevPrice = useRef<number | null>(null);
  const [priceFlash, setPriceFlash] = useState<"up" | "down" | null>(null);

  const fetchTeam = useCallback(() => {
    fetch(`/api/teams/${teamId}`)
      .then(r => r.json())
      .then((d: TeamDetail) => {
        if (prevPrice.current !== null && d.currentPrice !== prevPrice.current) {
          setPriceFlash(d.currentPrice > prevPrice.current ? "up" : "down");
          setTimeout(() => setPriceFlash(null), 700);
        }
        prevPrice.current = d.currentPrice;
        setTeam(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [teamId]);

  const fetchHolding = useCallback(() => {
    if (!user) return;
    fetch("/api/portfolio")
      .then(r => r.json())
      .then(data => {
        const h = data.holdings?.find((h: Holding) => h.teamId === teamId);
        setHolding(h ?? null);
      })
      .catch(() => {});
  }, [user, teamId]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);
  useEffect(() => { fetchHolding(); }, [fetchHolding]);
  // 30초 자동 갱신
  useEffect(() => {
    const iv = setInterval(fetchTeam, 30_000);
    return () => clearInterval(iv);
  }, [fetchTeam]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "#94a3b8" }}>
      <div>⏳ 불러오는 중...</div>
    </div>
  );
  if (!team) return (
    <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
      팀 정보를 찾을 수 없습니다. <Link href="/market" style={{ color: "#1251aa" }}>시장으로 →</Link>
    </div>
  );

  const stats = team.stats;
  const pnl   = holding ? (team.currentPrice - holding.avgBuyPrice) * holding.quantity : 0;
  const pnlR  = holding && holding.avgBuyPrice > 0 ? (team.currentPrice - holding.avgBuyPrice) / holding.avgBuyPrice : 0;

  const flashBg = priceFlash === "up" ? "#ecfdf5" : priceFlash === "down" ? "#fff5f5" : "white";

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", paddingBottom: 80 }}>
      {/* 뒤로 */}
      <Link href="/market" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        ← 종목 시장으로
      </Link>

      {/* 팀 헤더 카드 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 24px", marginBottom: 16, transition: "background 0.4s", backgroundColor: flashBg }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <TeamLogo emoji={team.logoEmoji} logoUrl={team.logoUrl} color={team.colorPrimary} size={60} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>{team.name}</h1>
            {stats && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", fontSize: 12, color: "#64748b" }}>
                <span>KBO <strong style={{ color: "#0f172a" }}>{stats.rank}위</strong></span>
                <span>·</span>
                <span><span style={{ color: "#0ab07a", fontWeight: 700 }}>{stats.wins}승</span> <span style={{ color: "#e53e3e", fontWeight: 700 }}>{stats.losses}패</span> {stats.draws}무</span>
                <span>·</span>
                <span>승률 {(stats.winRate * 100).toFixed(1)}%</span>
                {stats.streak !== 0 && (
                  <span style={{ fontWeight: 700, color: stats.streak > 0 ? "#0ab07a" : "#e53e3e" }}>
                    {stats.streak > 0 ? `🔥 ${stats.streak}연승` : `❄️ ${Math.abs(stats.streak)}연패`}
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums", lineHeight: 1.1 }}>
              {Math.round(team.currentPrice).toLocaleString()}<span style={{ fontSize: 14, fontWeight: 500, color: "#94a3b8", marginLeft: 3 }}>원</span>
            </div>
            <div style={{ marginTop: 4 }}><PriceChangeBadge rate={team.changeRate} size="lg" /></div>
          </div>
        </div>

        {/* 스탯 그리드 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 10, marginTop: 16 }}>
          {[
            { label: "거래량", value: team.volume.toLocaleString() },
            { label: "보유자", value: `${stats?.holderCount ?? 0}명` },
            { label: "KBO 순위", value: `${stats?.rank ?? "–"}위` },
            { label: "승률", value: `${((stats?.winRate ?? 0) * 100).toFixed(1)}%` },
            { label: "최근 5경기", value: <Last5Badge last5={stats?.last5 ?? ""} /> },
          ].map(s => (
            <div key={s.label} style={{ background: "#f8fafc", border: "1px solid #f1f5f9", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.label}</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 차트 + 거래 */}
      <div className="team-detail-grid">
        {/* 차트 영역 */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 20px 16px" }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: "#0f172a" }}>📈 주가 차트</h2>
          <PriceChart teamId={team.id} teamColor={team.colorPrimary} />
        </div>

        {/* 우측 패널 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 내 보유 현황 */}
          {holding && (
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>내 보유 현황</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "보유 수량",   value: `${holding.quantity}주` },
                  { label: "평균 매수가", value: `${Math.round(holding.avgBuyPrice).toLocaleString()}원` },
                  { label: "평가 금액",   value: `${Math.round(team.currentPrice * holding.quantity).toLocaleString()}원` },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                    <span style={{ color: "#64748b" }}>{s.label}</span>
                    <span style={{ fontWeight: 700, color: "#0f172a" }}>{s.value}</span>
                  </div>
                ))}
                <div style={{ height: 1, background: "#f1f5f9", margin: "2px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "#64748b" }}>평가 손익</span>
                  <span style={{ fontWeight: 900, color: pnl >= 0 ? "#0ab07a" : "#e53e3e" }}>
                    {pnl >= 0 ? "+" : ""}{Math.round(pnl).toLocaleString()}원 ({pnlR >= 0 ? "+" : ""}{(pnlR * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* 매수/매도 패널 */}
          <BuySellPanel
            teamId={team.id}
            teamName={team.name}
            currentPrice={Math.round(team.currentPrice)}
            availableShares={holding?.quantity ?? 0}
            onSuccess={() => { fetchTeam(); fetchHolding(); }}
          />
        </div>
      </div>
    </div>
  );
}
