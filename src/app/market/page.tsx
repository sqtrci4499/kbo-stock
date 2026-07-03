"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import PriceChangeBadge from "@/components/PriceChangeBadge";
import Last5Badge from "@/components/Last5Badge";
import TeamLogo from "@/components/TeamLogo";

interface Team {
  id: string; name: string; shortName: string; logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
  currentPrice: number; changeRate: number; volume: number; rank: number;
  wins: number; losses: number; draws: number; winRate: number;
  streak: number; last5: string; holderCount: number;
}

type SortKey = "rank" | "currentPrice" | "changeRate" | "volume";
type LoadState = "loading" | "ok" | "empty" | "error";

export default function MarketPage() {
  const [teams, setTeams]         = useState<Team[]>([]);
  const [sort, setSort]           = useState<SortKey>("rank");
  const [dir, setDir]             = useState<1 | -1>(1);
  const [state, setState]         = useState<LoadState>("loading");
  const [errorMsg, setErrorMsg]   = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchTeams = useCallback(async () => {
    try {
      const res  = await fetch("/api/teams");
      const data = await res.json();

      if (!Array.isArray(data)) {
        // 객체 에러 응답인 경우
        const msg = (data as any)?.error ?? "알 수 없는 오류";
        setErrorMsg(msg);
        setState("error");
        return;
      }

      if (data.length === 0) {
        setState("empty");
        return;
      }

      setTeams(data);
      setLastUpdate(new Date());
      setState("ok");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "네트워크 오류";
      setErrorMsg(msg);
      setState("error");
    }
  }, []);

  useEffect(() => {
    fetchTeams();
    const iv = setInterval(fetchTeams, 30_000);
    return () => clearInterval(iv);
  }, [fetchTeams]);

  const handleSort = (key: SortKey) => {
    if (sort === key) setDir(d => d === 1 ? -1 : 1);
    else { setSort(key); setDir(key === "rank" ? 1 : -1); }
  };

  const sorted = [...teams].sort((a, b) => (Number(a[sort]) - Number(b[sort])) * dir);

  const Th = ({ k, label, right = true }: { k: SortKey; label: string; right?: boolean }) => (
    <th onClick={() => handleSort(k)} style={{
      padding: "10px 14px", textAlign: right ? "right" : "left",
      fontSize: 11, fontWeight: 600,
      color: sort === k ? "#1251aa" : "#64748b",
      background: "#f8fafc", borderBottom: "1px solid #e2e8f0",
      cursor: "pointer", userSelect: "none", whiteSpace: "nowrap",
    }}>
      {label}{sort === k ? (dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );

  // ── 로딩 ───────────────────────────────────────────
  if (state === "loading") {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 300, gap: 12 }}>
        <div style={{ fontSize: 32 }}>⏳</div>
        <div style={{ color: "#64748b", fontSize: 14 }}>시세 불러오는 중...</div>
      </div>
    );
  }

  // ── 에러 ───────────────────────────────────────────
  if (state === "error") {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 14, padding: "24px 24px" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>❌</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#7f1d1d", marginBottom: 8 }}>DB 연결 오류</h2>
          <p style={{ fontSize: 13, color: "#7f1d1d", marginBottom: 16, lineHeight: 1.6 }}>{errorMsg}</p>
          <div style={{ background: "#fef2f2", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#991b1b", lineHeight: 1.8 }}>
            <strong>해결 방법:</strong><br />
            1. PostgreSQL이 실행 중인지 확인<br />
            2. <code>.env</code> 파일의 <code>DATABASE_URL</code> 확인<br />
            3. <code>npm run db:seed</code> 재실행<br />
            4. <a href="/api/health" target="_blank" style={{ color: "#1251aa" }}>/api/health</a> 에서 상세 진단
          </div>
          <button onClick={fetchTeams} style={{ marginTop: 14, padding: "8px 20px", background: "#1251aa", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  // ── 데이터 없음 ────────────────────────────────────
  if (state === "empty") {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto", padding: "0 16px" }}>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, padding: "28px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#92400e", marginBottom: 8 }}>팀 데이터가 없습니다</h2>
          <p style={{ fontSize: 13, color: "#78350f", marginBottom: 16, lineHeight: 1.7 }}>
            DB에 연결되었지만 팀 데이터가 없습니다.<br />
            아래 명령을 실행하여 초기 데이터를 삽입하세요.
          </p>
          <div style={{ background: "#0f172a", borderRadius: 8, padding: "12px 16px", textAlign: "left", marginBottom: 16 }}>
            <code style={{ color: "#86efac", fontSize: 13 }}>npm run db:seed</code>
          </div>
          <p style={{ fontSize: 11, color: "#92400e" }}>
            <a href="/api/health" target="_blank" style={{ color: "#1251aa" }}>/api/health</a> 에서 상세 상태 확인 가능
          </p>
          <button onClick={fetchTeams} style={{ marginTop: 14, padding: "8px 20px", background: "#d97706", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
            새로고침
          </button>
        </div>
      </div>
    );
  }

  // ── 정상 ───────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>🏪 KBO 종목 시장</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>
            {lastUpdate && `${lastUpdate.toLocaleTimeString("ko-KR")} 기준`} · 30초 자동갱신 · {teams.length}개 종목
          </p>
        </div>
        <button onClick={fetchTeams} style={{ padding: "7px 14px", border: "1.5px solid #e2e8f0", borderRadius: 7, background: "white", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          🔄 새로고침
        </button>
      </div>

      {/* 데스크탑 테이블 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", display: "none" }} className="md:block">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <Th k="rank" label="KBO순위" right={false} />
                <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>구단</th>
                <Th k="currentPrice" label="현재가" />
                <Th k="changeRate" label="등락률" />
                <Th k="volume" label="거래량" />
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>승/패</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>최근 5경기</th>
                <th style={{ padding: "10px 14px", textAlign: "center", fontSize: 11, fontWeight: 600, color: "#64748b", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>연속</th>
                <th style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(t => (
                <tr key={t.id}
                  style={{ borderBottom: "1px solid #f8fafc", cursor: "pointer" }}
                  onClick={() => window.location.href = `/teams/${t.id}`}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={{ padding: "12px 14px", fontWeight: 700, color: "#94a3b8", fontSize: 13, width: 48 }}>{t.rank}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <TeamLogo emoji={t.logoEmoji} logoUrl={t.logoUrl} color={t.colorPrimary} size={36} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{t.name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>보유자 {t.holderCount}명</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <span style={{ fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(t.currentPrice).toLocaleString()}
                    </span>
                    <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 2 }}>원</span>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right" }}>
                    <PriceChangeBadge rate={t.changeRate} animate />
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "right", color: "#475569", fontVariantNumeric: "tabular-nums" }}>
                    {t.volume.toLocaleString()}
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 12 }}>
                    <span style={{ color: "#0ab07a", fontWeight: 700 }}>{t.wins}승</span>{" "}
                    <span style={{ color: "#e53e3e" }}>{t.losses}패</span>
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", justifyContent: "center" }}>
                      <Last5Badge last5={t.last5} />
                    </div>
                  </td>
                  <td style={{ padding: "12px 14px", textAlign: "center", fontSize: 11, fontWeight: 700 }}>
                    {t.streak > 0
                      ? <span style={{ color: "#0ab07a" }}>🔥 {t.streak}연승</span>
                      : t.streak < 0
                      ? <span style={{ color: "#e53e3e" }}>❄️ {Math.abs(t.streak)}연패</span>
                      : <span style={{ color: "#94a3b8" }}>—</span>}
                  </td>
                  <td style={{ padding: "12px 14px" }}>
                    <Link href={`/teams/${t.id}`} onClick={e => e.stopPropagation()}
                      style={{ display: "inline-block", background: "#eff6ff", color: "#1251aa", border: "1px solid #bfdbfe", borderRadius: 6, padding: "5px 12px", fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                      거래
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 모바일 카드 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }} className="md:hidden">
        {sorted.map(t => (
          <Link key={t.id} href={`/teams/${t.id}`} style={{ textDecoration: "none", display: "block" }}>
            <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#94a3b8", width: 20, textAlign: "center" }}>{t.rank}</span>
              <TeamLogo emoji={t.logoEmoji} logoUrl={t.logoUrl} color={t.colorPrimary} size={40} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{t.name}</div>
                <Last5Badge last5={t.last5} />
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(t.currentPrice).toLocaleString()}원
                </div>
                <PriceChangeBadge rate={t.changeRate} size="sm" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
