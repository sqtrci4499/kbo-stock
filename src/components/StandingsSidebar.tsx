"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import TeamLogo from "./TeamLogo";
import Last5Badge from "./Last5Badge";

interface Standing {
  id: string; name: string; shortName: string;
  logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  rank: number; wins: number; losses: number; draws: number;
  winRate: number; gamesBehind: number; streak: number; last5: string;
}

/**
 * 홈 화면 우측 사이드바 전용 "KBO 순위" — 표시항목: 팀명/승/패/승률/게임차/최근5경기
 * (수정안 7번: 홈에 들어오면 오른쪽에서 항상 최신 순위를 볼 수 있어야 함)
 */
export default function StandingsSidebar() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error">("loading");

  useEffect(() => {
    fetch("/api/standings/current")
      .then(r => r.json())
      .then(d => {
        if (d?.success && Array.isArray(d.standings) && d.standings.length > 0) {
          setStandings(d.standings);
          setLastSyncedAt(d.lastSyncedAt ?? null);
          setState("ok");
        } else if (d?.success) {
          setState("empty");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
      <div style={{ padding: "13px 16px", borderBottom: "1px solid #f1f5f9" }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>🏆 KBO 순위</div>
        {lastSyncedAt && (
          <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
            {new Date(lastSyncedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 기준
          </div>
        )}
      </div>

      {state === "loading" && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>불러오는 중...</div>
      )}
      {state === "error" && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#e53e3e", fontSize: 12 }}>순위를 불러오지 못했습니다.</div>
      )}
      {state === "empty" && (
        <div style={{ padding: "24px 16px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>아직 순위 데이터가 없습니다.</div>
      )}

      {state === "ok" && (
        <div>
          {standings.map((s, i) => (
            <Link key={s.id} href={`/teams/${s.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                borderBottom: i === standings.length - 1 ? "none" : "1px solid #f8fafc",
                cursor: "pointer",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ width: 16, fontSize: 12, fontWeight: 800, color: s.rank <= 3 ? "#1251aa" : "#94a3b8", flexShrink: 0 }}>
                  {s.rank}
                </span>
                <TeamLogo emoji={s.logoEmoji} logoUrl={s.logoUrl} color={s.colorPrimary} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12.5, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.shortName}
                  </div>
                  <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 1 }}>
                    {s.wins}승 {s.losses}패 · {(s.winRate * 100).toFixed(1)}% · {s.gamesBehind === 0 ? "선두" : `${s.gamesBehind.toFixed(1)}G`}
                  </div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Last5Badge last5={s.last5} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
