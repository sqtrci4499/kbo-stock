"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface RankEntry {
  rank: number; userId: string; nickname: string;
  totalAsset: string; profitRate: number; isMe: boolean;
}

const MEDAL_STYLE: Record<number, { bg: string; color: string; icon: string }> = {
  1: { bg: "#fef9c3", color: "#d97706", icon: "🥇" },
  2: { bg: "#f1f5f9", color: "#64748b", icon: "🥈" },
  3: { bg: "#fff7ed", color: "#c2410c", icon: "🥉" },
};

export default function RankingPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<RankEntry[]>([]);
  const [myRank, setMyRank]     = useState<number | null>(null);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/ranking?limit=50")
      .then(r => r.json())
      .then(data => {
        setRankings(data.rankings ?? []);
        setMyRank(data.myRank ?? null);
        setTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 280, color: "#94a3b8" }}>⏳ 랭킹 불러오는 중...</div>
  );

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>🏆 투자자 랭킹</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>전체 {total}명 참여 중</p>
        </div>
        <div style={{ fontSize: 11, color: "#94a3b8", background: "white", border: "1px solid #e2e8f0", padding: "5px 10px", borderRadius: 6 }}>
          총 자산 기준
        </div>
      </div>

      {/* 내 순위 카드 */}
      {user && myRank && (
        <div style={{
          background: "linear-gradient(135deg, #1251aa, #1e40af)",
          borderRadius: 14, padding: "16px 20px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 16
        }}>
          <div style={{ fontSize: 28, fontWeight: 900, color: "white", minWidth: 48, textAlign: "center" }}>
            {myRank}위
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: "white", fontSize: 15 }}>
              {user.nickname}
              <span style={{ fontSize: 10, background: "rgba(255,255,255,0.25)", padding: "2px 6px", borderRadius: 4, marginLeft: 8 }}>나</span>
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
              총 자산 {parseInt(user.totalAsset).toLocaleString()}원
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: user.profitRate >= 0 ? "#86efac" : "#fca5a5", fontVariantNumeric: "tabular-nums" }}>
              {user.profitRate >= 0 ? "+" : ""}{(user.profitRate * 100).toFixed(2)}%
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>수익률</div>
          </div>
        </div>
      )}

      {/* 랭킹 테이블 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        {/* 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr 140px 90px", padding: "10px 20px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["순위", "투자자", "총 자산", "수익률"].map((h, i) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: i > 1 ? "right" : "left" }}>{h}</div>
          ))}
        </div>

        {rankings.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
            랭킹 데이터가 없습니다
          </div>
        ) : (
          rankings.map((r, i) => {
            const medal = MEDAL_STYLE[r.rank];
            return (
              <div
                key={r.userId}
                style={{
                  display: "grid", gridTemplateColumns: "52px 1fr 140px 90px",
                  alignItems: "center", padding: "13px 20px",
                  borderBottom: i < rankings.length - 1 ? "1px solid #f8fafc" : "none",
                  background: r.isMe ? "#eff6ff" : medal ? medal.bg : "transparent",
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => { if (!r.isMe && !medal) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!r.isMe && !medal) e.currentTarget.style.background = "transparent"; }}
              >
                {/* 순위 */}
                <div style={{ textAlign: "center" }}>
                  {medal ? (
                    <span style={{ fontSize: 20 }}>{medal.icon}</span>
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#94a3b8" }}>{r.rank}</span>
                  )}
                </div>

                {/* 닉네임 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: "50%",
                    background: r.isMe ? "#1251aa" : medal ? medal.color : "#e2e8f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: r.isMe || medal ? "white" : "#64748b", fontSize: 12, fontWeight: 700, flexShrink: 0
                  }}>
                    {r.nickname[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nickname}
                      {r.isMe && (
                        <span style={{ fontSize: 10, background: "#1251aa", color: "white", padding: "1px 5px", borderRadius: 4, marginLeft: 6 }}>나</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 총 자산 */}
                <div style={{ textAlign: "right", fontWeight: 700, fontSize: 13, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>
                  {parseInt(r.totalAsset).toLocaleString()}원
                </div>

                {/* 수익률 */}
                <div style={{
                  textAlign: "right", fontWeight: 800, fontSize: 13,
                  color: r.profitRate >= 0 ? "#0ab07a" : "#e53e3e",
                  fontVariantNumeric: "tabular-nums"
                }}>
                  {r.profitRate >= 0 ? "+" : ""}{(r.profitRate * 100).toFixed(2)}%
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 안내 */}
      <div style={{ marginTop: 14, padding: "12px 16px", background: "white", border: "1px solid #e2e8f0", borderRadius: 10, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        💡 랭킹은 총 자산(현금 + 주식 평가금)을 기준으로 산정됩니다
      </div>
    </div>
  );
}
