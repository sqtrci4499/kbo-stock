"use client";
import { useEffect, useState, useCallback } from "react";
import TeamLogo from "@/components/TeamLogo";
import PriceChangeBadge from "@/components/PriceChangeBadge";
import Last5Badge from "@/components/Last5Badge";

interface TeamPrediction {
  teamId: string; name: string; shortName: string;
  logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  currentPrice: number; changeRate: number;
  rank: number; wins: number; losses: number; winRate: number;
  streak: number; last5: string;
  aiScore: number | null; stars: number | null;
  recommendation: string | null; comment: string | null;
  adminComment: string | null; adminCommentUpdatedAt: string | null;
  updatedAt: string | null;
}

type LoadState = "loading" | "ok" | "empty" | "error";

const REC_COLOR: Record<string, { bg: string; fg: string }> = {
  "적극 매수": { bg: "#f0fdf4", fg: "#0ab07a" },
  "매수":      { bg: "#eff6ff", fg: "#1251aa" },
  "보유":      { bg: "#f8fafc", fg: "#64748b" },
  "관망":      { bg: "#fff7ed", fg: "#d97706" },
  "주의":      { bg: "#fff5f5", fg: "#e53e3e" },
};

function Stars({ n }: { n: number }) {
  return (
    <span style={{ letterSpacing: 1, fontSize: 14 }}>
      {"★".repeat(n)}
      <span style={{ color: "#e2e8f0" }}>{"★".repeat(5 - n)}</span>
    </span>
  );
}

export default function PredictionsPage() {
  const [teams, setTeams] = useState<TeamPrediction[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchPredictions = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-predictions");
      const data = await res.json();
      if (!Array.isArray(data)) {
        setErrorMsg((data as any)?.error ?? "알 수 없는 오류");
        setState("error");
        return;
      }
      if (data.length === 0) { setState("empty"); return; }
      setTeams(data);
      setState("ok");
      setLastUpdate(new Date());
    } catch {
      setErrorMsg("서버에 연결할 수 없습니다.");
      setState("error");
    }
  }, []);

  useEffect(() => { fetchPredictions(); }, [fetchPredictions]);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 80 }} className="animate-fade-in">
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          🤖 AI 예측
        </h1>
        <p style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
          순위·최근 5경기·승률·연승연패·게임차·최근 주가 변화를 종합해 매일 자동으로 계산됩니다. (임의의 문구가 아닌 실제 데이터 기반)
        </p>
        {lastUpdate && (
          <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            마지막 갱신: {teams[0]?.updatedAt ? new Date(teams[0].updatedAt).toLocaleString("ko-KR") : "-"}
          </p>
        )}
      </div>

      {state === "loading" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: 13 }}>불러오는 중...</div>
      )}

      {state === "error" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#e53e3e", fontSize: 13 }}>
          ⚠️ {errorMsg || "AI 예측 데이터를 불러오지 못했습니다."}
        </div>
      )}

      {state === "empty" && (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: 13 }}>
          아직 AI 예측 데이터가 없습니다. 관리자 페이지에서 "AI 예측 재생성"을 먼저 실행해주세요.
        </div>
      )}

      {state === "ok" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
          {teams.map(t => {
            const rec = t.recommendation ?? "보유";
            const color = REC_COLOR[rec] ?? REC_COLOR["보유"];
            return (
              <div key={t.teamId} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <TeamLogo emoji={t.logoEmoji} logoUrl={t.logoUrl} color={t.colorPrimary} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{t.rank}위 · {t.wins}승 {t.losses}패 · 승률 {(t.winRate * 100).toFixed(1)}%</div>
                  </div>
                  <PriceChangeBadge rate={t.changeRate} size="sm" />
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div>
                    <Stars n={t.stars ?? 3} />
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>AI Score {t.aiScore ?? "-"}/100</div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 800, padding: "6px 14px", borderRadius: 20,
                    background: color.bg, color: color.fg,
                  }}>{rec}</span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <Last5Badge last5={t.last5} />
                  {t.streak !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: t.streak > 0 ? "#0ab07a" : "#e53e3e" }}>
                      {t.streak > 0 ? `🔥${t.streak}연승` : `❄️${Math.abs(t.streak)}연패`}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.6, background: "#f8fafc", borderRadius: 8, padding: "10px 12px", margin: 0 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: t.adminComment ? "#1251aa" : "#64748b", display: "block", marginBottom: 4 }}>
                    {t.adminComment ? "📝🤖 담당자 코멘트 + AI 종합 분석" : "🤖 AI 데이터 분석"}
                  </span>
                  {t.comment || "코멘트가 아직 생성되지 않았습니다."}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
