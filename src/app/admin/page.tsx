"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";
import PriceChangeBadge from "@/components/PriceChangeBadge";

interface Team { id: string; name: string; shortName: string; logoEmoji: string; logoUrl?: string | null; colorPrimary: string; currentPrice: number; }
interface Game {
  id: string; gameDate: string; priceApplied: boolean; status: string;
  homeScore: number | null; awayScore: number | null;
  homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string };
}
interface SettleResult { teamName: string; prevClose: number; newClose: number; changeRate: number; }
interface User { id: string; nickname: string; email: string; role: string; status: string; totalAsset: string; createdAt: string; }

type Tab = "games" | "price" | "users" | "notice" | "session" | "reset" | "sync";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("games");

  // 팀 목록
  const [teams, setTeams] = useState<Team[]>([]);

  // 경기 탭
  const [games, setGames] = useState<Game[]>([]);
  const [gameForm, setGameForm] = useState({ homeTeamId: "", awayTeamId: "", homeScore: "", awayScore: "", gameDate: new Date().toISOString().slice(0, 10) });
  const [settling, setSettling] = useState<string | null>(null);
  const [settleResult, setSettleResult] = useState<SettleResult[] | null>(null);
  const [gameSubmitting, setGameSubmitting] = useState(false);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ totalGames: number; newlyFinal: number; usedSource: string; errors: string[]; syncedAt: string } | null>(null);
  const [standingsSyncing, setStandingsSyncing] = useState(false);
  const [standingsResult, setStandingsResult] = useState<{ success: boolean; teamCount: number; provider: string; syncedAt: string; message?: string } | null>(null);
  const [priceRecalcing, setPriceRecalcing] = useState(false);
  const [aiRegenerating, setAiRegenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ success: boolean; count: number; error?: string } | null>(null);
  const [dailyRunning, setDailyRunning] = useState(false);
  const [dailyResult, setDailyResult] = useState<{ success: boolean; message?: string } | null>(null);
  const [realigning, setRealigning] = useState(false);
  const [realignResult, setRealignResult] = useState<{ ok: boolean; count?: number; error?: string } | null>(null);

  // 주가 탭
  const [priceForm, setPriceForm] = useState({ teamId: "", price: "" });
  const [priceResult, setPriceResult] = useState<any>(null);

  // 유저 탭
  const [users, setUsers] = useState<User[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [userTotal, setUserTotal] = useState(0);

  // 공지 탭
  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", isPinned: false });

  // 거래세션 탭
  const [sessionForm, setSessionForm] = useState({ openAt: "", closeAt: "", description: "" });

  // 공통
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.push("/");
  }, [user, authLoading, router]);

  const fetchTeams = useCallback(() => {
    fetch("/api/teams").then(r => r.json()).then(d => Array.isArray(d) && setTeams(d));
  }, []);
  const fetchGames = useCallback(() => {
    fetch("/api/admin/games").then(r => r.json()).then(d => Array.isArray(d) && setGames(d)).catch(() => {});
  }, []);
  const [userActionLoading, setUserActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(() => {
    fetch(`/api/admin/users?search=${userSearch}`).then(r => r.json())
      .then(d => { setUsers(d.users ?? []); setUserTotal(d.total ?? 0); }).catch(() => {});
  }, [userSearch]);

  useEffect(() => {
    fetchTeams();
    fetchGames();
  }, [fetchTeams, fetchGames]);
  useEffect(() => { if (tab === "users") fetchUsers(); }, [tab, fetchUsers]);

  const handleUserRoleToggle = async (u: User) => {
    const nextRole = u.role === "admin" ? "user" : "admin";
    if (!confirm(`${u.nickname}님의 권한을 '${nextRole === "admin" ? "관리자" : "유저"}'로 변경할까요?`)) return;
    setUserActionLoading(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "권한 변경에 실패했습니다.");
    } finally { setUserActionLoading(null); }
  };

  const handleUserStatusToggle = async (u: User) => {
    const nextStatus = u.status === "active" ? "inactive" : "active";
    if (!confirm(`${u.nickname}님의 계정을 '${nextStatus === "active" ? "활성" : "비활성"}' 상태로 변경할까요?`)) return;
    setUserActionLoading(u.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "상태 변경에 실패했습니다.");
    } finally { setUserActionLoading(null); }
  };

  const handleUserDelete = async (u: User) => {
    if (!confirm(`${u.nickname}(${u.email}) 계정을 강제 탈퇴 처리할까요? 이 작업은 되돌릴 수 없습니다.`)) return;
    setUserActionLoading(u.id);
    try {
      const res = await fetch(`/api/admin/users?userId=${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchUsers();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "탈퇴 처리에 실패했습니다.");
    } finally { setUserActionLoading(null); }
  };

  const msg = (ok: boolean, text: string) => {
    setError(""); setSuccess("");
    if (ok) setSuccess(text); else setError(text);
    setTimeout(() => { setSuccess(""); setError(""); }, 5000);
  };

  // ── 자동 경기 동기화 ─────────────────────────────
  const handleAutoSync = async () => {
    setAutoSyncing(true);
    try {
      const res  = await fetch("/api/games/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "동기화 실패");
      setSyncResult(data);
      if (data.errors?.length > 0) {
        msg(false, `동기화 완료(일부 오류): ${data.errors[0]}`);
      } else if (data.newlyFinal > 0) {
        msg(true, `✅ 동기화 완료! 신규 종료 경기 ${data.newlyFinal}건 자동 정산됨`);
      } else {
        msg(true, `✅ 동기화 완료 (${data.usedSource} 소스, ${data.totalGames}경기 확인)`);
      }
      fetchGames();
    } catch (e: any) { msg(false, e.message); }
    finally { setAutoSyncing(false); }
  };

  // ── 경기 등록 ───────────────────────────────────
  const handleGameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (gameForm.homeTeamId === gameForm.awayTeamId) { msg(false, "홈팀과 원정팀이 같습니다."); return; }
    setGameSubmitting(true);
    try {
      const res  = await fetch("/api/admin/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gameForm, homeScore: parseInt(gameForm.homeScore), awayScore: parseInt(gameForm.awayScore) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msg(true, `✅ ${data.homeTeam} ${data.homeScore} : ${data.awayScore} ${data.awayTeam} 등록`);
      setGameForm(f => ({ ...f, homeScore: "", awayScore: "" }));
      fetchGames();
    } catch (e: any) { msg(false, e.message); }
    finally { setGameSubmitting(false); }
  };

  // ── 팀 순위 동기화 ─────────────────────────────
  const handleStandingsSync = async () => {
    setStandingsSyncing(true);
    try {
      const res  = await fetch("/api/standings/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "순위 동기화 실패");
      setStandingsResult(data);
      if (data.success) {
        msg(true, `✅ KBO 순위 동기화 완료 (${data.teamCount}팀, 소스: ${data.provider})`);
      } else {
        msg(false, `순위 동기화 실패: ${data.message ?? "알 수 없는 오류"}`);
      }
    } catch (e: any) { msg(false, e.message); }
    finally { setStandingsSyncing(false); }
  };

  // ── 전체 유저 자산 재계산 ────────────────────────
  const handlePriceRecalc = async () => {
    setPriceRecalcing(true);
    try {
      const res  = await fetch("/api/admin/recalc", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "재계산 실패");
      msg(true, "✅ 전체 유저 자산 재계산 완료");
    } catch (e: any) { msg(false, e.message); }
    finally { setPriceRecalcing(false); }
  };

  // ── 순위/승률 기준 가격 재정렬 ─────────────────────
  const handleRealign = async () => {
    setRealigning(true);
    try {
      const res  = await fetch("/api/admin/price/realign", { method: "POST" });
      const data = await res.json();
      setRealignResult(data);
      if (!data.ok) throw new Error(data.error ?? "가격 재정렬 실패");
      msg(true, `✅ ${data.count}팀 가격 재정렬 완료`);
      fetchTeams();
    } catch (e: any) { msg(false, e.message); }
    finally { setRealigning(false); }
  };

  // ── AI 예측 재생성 ─────────────────────────────
  const handleAiRegenerate = async () => {
    setAiRegenerating(true);
    try {
      const res  = await fetch("/api/admin/ai-predictions/regenerate", { method: "POST" });
      const data = await res.json();
      setAiResult(data);
      if (!data.success) throw new Error(data.error ?? "AI 예측 재생성 실패");
      msg(true, `✅ AI 예측 재생성 완료 (${data.count}팀)`);
    } catch (e: any) { msg(false, e.message); }
    finally { setAiRegenerating(false); }
  };

  // ── 일일 업데이트 일괄 실행 (경기결과→순위→자산재계산→AI예측) ──
  const handleDailyUpdate = async () => {
    setDailyRunning(true);
    try {
      const res  = await fetch("/api/admin/daily-update", { method: "POST" });
      const data = await res.json();
      setDailyResult(data);
      if (!res.ok || data.success === false) throw new Error(data.message ?? "일일 업데이트 실패");
      msg(true, `✅ ${data.message ?? "일일 업데이트 완료"}`);
      fetchGames();
    } catch (e: any) { msg(false, e.message); }
    finally { setDailyRunning(false); }
  };

  // ── 주가 정산 ───────────────────────────────────
  const handleSettle = async (gameId: string) => {
    setSettling(gameId); setSettleResult(null);
    try {
      const res  = await fetch(`/api/admin/games/${gameId}/settle`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettleResult(data.results);
      msg(true, "✅ 주가 정산 완료!");
      fetchGames();
    } catch (e: any) { msg(false, e.message); }
    finally { setSettling(null); }
  };

  // ── 주가 강제 수정 ───────────────────────────────
  const handlePriceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res  = await fetch("/api/admin/price", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teamId: priceForm.teamId, price: parseFloat(priceForm.price) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPriceResult(data);
      msg(true, "✅ 주가 수정 완료");
    } catch (e: any) { msg(false, e.message); }
  };

  // ── 공지사항 등록 ────────────────────────────────
  const handleNoticeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res  = await fetch("/api/admin/notice", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(noticeForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msg(true, "✅ 공지사항 등록 완료");
      setNoticeForm({ title: "", content: "", isPinned: false });
    } catch (e: any) { msg(false, e.message); }
  };

  // ── 거래 세션 등록 ───────────────────────────────
  const handleSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res  = await fetch("/api/admin/trade-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sessionForm) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msg(true, "✅ 거래 세션 등록 완료");
      setSessionForm({ openAt: "", closeAt: "", description: "" });
    } catch (e: any) { msg(false, e.message); }
  };

  // ── 시즌 초기화 ──────────────────────────────────
  const handleReset = async () => {
    if (!confirm("⚠️ 모든 유저의 포트폴리오와 거래내역이 초기화됩니다.\n정말 진행하시겠습니까?")) return;
    const confirm2 = prompt('확인을 위해 "RESET_SEASON" 을 입력하세요');
    if (confirm2 !== "RESET_SEASON") { msg(false, "취소되었습니다."); return; }
    try {
      const res  = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "RESET_SEASON" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      msg(true, "✅ 시즌 초기화 완료");
    } catch (e: any) { msg(false, e.message); }
  };

  if (authLoading || !user || user.role !== "admin") return null;

  const homeTeam = teams.find(t => t.id === gameForm.homeTeamId);
  const awayTeam = teams.find(t => t.id === gameForm.awayTeamId);

  const TABS: { k: Tab; label: string }[] = [
    { k: "games",   label: "⚾ 경기 관리" },
    { k: "price",   label: "💹 주가 수정" },
    { k: "users",   label: "👤 유저 관리" },
    { k: "notice",  label: "📢 공지사항" },
    { k: "session", label: "🕐 거래 세션" },
    { k: "reset",   label: "🔄 시즌 초기화" },
    { k: "sync",    label: "🔗 v6 동기화" },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>⚙️ 관리자</h1>
        <span style={{ fontSize: 11, background: "#fee2e2", color: "#dc2626", padding: "3px 9px", borderRadius: 20, fontWeight: 700 }}>ADMIN</span>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: "1.5px solid", fontFamily: "inherit",
            borderColor: tab === t.k ? "#1251aa" : "#e2e8f0",
            background: tab === t.k ? "#eff6ff" : "white",
            color: tab === t.k ? "#1251aa" : "#64748b",
          }}>{t.label}</button>
        ))}
      </div>

      {/* 공통 메시지 */}
      {(error || success) && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
          background: error ? "#fff5f5" : "#f0fdf4",
          color: error ? "#e53e3e" : "#0ab07a",
          border: `1px solid ${error ? "#fecaca" : "#bbf7d0"}`,
        }}>{error || success}</div>
      )}

      {/* ── 경기 관리 탭 ── */}
      {tab === "games" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* 자동 동기화 패널 (전체 폭) */}
          <div style={{ gridColumn: "1 / -1", background: "linear-gradient(135deg,#0f172a,#1251aa)", borderRadius: 14, padding: "20px 22px", color: "white" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🔄 자동 경기 수집 &amp; 정산</h2>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                  외부 소스(네이버 스포츠 → 스탯티즈 → Mock 순)에서 오늘 경기를 자동 수집하고,
                  종료된 경기는 즉시 주가에 반영합니다.
                </p>
              </div>
              <button onClick={handleAutoSync} disabled={autoSyncing} style={{
                padding: "11px 22px", borderRadius: 9, border: "none",
                background: "white", color: "#1251aa", fontWeight: 800, fontSize: 13,
                cursor: autoSyncing ? "wait" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
              }}>
                {autoSyncing ? "동기화 중..." : "⚡ 지금 자동 동기화"}
              </button>
            </div>

            {syncResult && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.15)", display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12 }}>
                <span>📡 소스: <strong>{syncResult.usedSource}</strong></span>
                <span>⚾ 확인된 경기: <strong>{syncResult.totalGames}</strong>건</span>
                <span>💰 신규 정산: <strong style={{ color: "#86efac" }}>{syncResult.newlyFinal}</strong>건</span>
                <span style={{ color: "rgba(255,255,255,0.6)" }}>{new Date(syncResult.syncedAt).toLocaleTimeString("ko-KR")}</span>
              </div>
            )}
            {syncResult && syncResult.errors.length > 0 && (
              <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(220,38,38,0.2)", borderRadius: 7, fontSize: 11 }}>
                ⚠️ {syncResult.errors.length}건의 부분 오류 (전체 동작에는 영향 없음): {syncResult.errors[0]}
              </div>
            )}

            <div style={{ marginTop: 12, fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              💡 <code style={{ background: "rgba(255,255,255,0.1)", padding: "1px 5px", borderRadius: 3 }}>/api/games/sync</code>를
              외부 Cron(Vercel Cron 등)으로 주기 호출하면 완전 자동화됩니다.
            </div>
          </div>

          {/* 등록 폼 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>📋 경기 결과 수동 입력</h2>
            <form onSubmit={handleGameSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>홈팀</label>
                  <select required value={gameForm.homeTeamId} onChange={e => setGameForm(f => ({ ...f, homeTeamId: e.target.value }))} className="input-base" style={{ padding: "9px 10px" }}>
                    <option value="">선택</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>원정팀</label>
                  <select required value={gameForm.awayTeamId} onChange={e => setGameForm(f => ({ ...f, awayTeamId: e.target.value }))} className="input-base" style={{ padding: "9px 10px" }}>
                    <option value="">선택</option>
                    {teams.filter(t => t.id !== gameForm.homeTeamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {homeTeam && awayTeam && (
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                  <div style={{ textAlign: "center" }}>
                    <TeamLogo emoji={homeTeam.logoEmoji} logoUrl={homeTeam.logoUrl} color={homeTeam.colorPrimary} size={36} />
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>{homeTeam.shortName}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min="0" max="30" required value={gameForm.homeScore}
                      onChange={e => setGameForm(f => ({ ...f, homeScore: e.target.value }))} placeholder="0"
                      style={{ width: 52, textAlign: "center", fontSize: 22, fontWeight: 900, border: "2px solid #e2e8f0", borderRadius: 8, padding: "6px 0", fontFamily: "inherit", color: "#0f172a", outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "#1251aa"}
                      onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                    <span style={{ fontSize: 18, color: "#94a3b8", fontWeight: 700 }}>:</span>
                    <input type="number" min="0" max="30" required value={gameForm.awayScore}
                      onChange={e => setGameForm(f => ({ ...f, awayScore: e.target.value }))} placeholder="0"
                      style={{ width: 52, textAlign: "center", fontSize: 22, fontWeight: 900, border: "2px solid #e2e8f0", borderRadius: 8, padding: "6px 0", fontFamily: "inherit", color: "#0f172a", outline: "none" }}
                      onFocus={e => e.target.style.borderColor = "#1251aa"}
                      onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <TeamLogo emoji={awayTeam.logoEmoji} logoUrl={awayTeam.logoUrl} color={awayTeam.colorPrimary} size={36} />
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>{awayTeam.shortName}</div>
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>경기 날짜</label>
                <input type="date" required value={gameForm.gameDate}
                  onChange={e => setGameForm(f => ({ ...f, gameDate: e.target.value }))} className="input-base" />
              </div>

              <button type="submit" disabled={gameSubmitting} className="btn-primary" style={{ padding: "12px", fontSize: 14, borderRadius: 9 }}>
                {gameSubmitting ? "등록 중..." : "경기 결과 등록"}
              </button>
            </form>
          </div>

          {/* 정산 로직 & 결과 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>📊 주가 정산 규칙</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, marginBottom: 16 }}>
              {[
                ["✅ 승리", "+3.0%", "#0ab07a"],
                ["❌ 패배", "-2.0%", "#e53e3e"],
                ["🏠 홈경기 승리", "+0.5%", "#0ab07a"],
                ["🔥 연승 (1경기당)", "+1.0%", "#0ab07a"],
                ["❄️ 연패 (1경기당)", "-1.0%", "#e53e3e"],
                ["💥 5점차 이상 득점", "+1.5%", "#0ab07a"],
                ["💔 5점차 이상 실점", "-1.5%", "#e53e3e"],
                ["📦 유저 수급 반영", "30%", "#1251aa"],
              ].map(([label, val, color]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 12px", background: "#f8fafc", borderRadius: 7 }}>
                  <span style={{ color: "#475569" }}>{label}</span>
                  <span style={{ fontWeight: 700, color }}>{val}</span>
                </div>
              ))}
            </div>
            {settleResult && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 8 }}>정산 결과</div>
                {settleResult.map(r => (
                  <div key={r.teamName} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 7, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>{r.teamName}</span>
                    <span style={{ color: "#64748b", fontVariantNumeric: "tabular-nums" }}>
                      {Math.round(r.prevClose).toLocaleString()} → <strong style={{ color: "#0f172a" }}>{Math.round(r.newClose).toLocaleString()}원</strong>
                    </span>
                    <PriceChangeBadge rate={r.changeRate} size="sm" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 경기 목록 */}
          <div style={{ gridColumn: "1 / -1", background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid #f1f5f9" }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>최근 경기 ({games.length}건)</span>
            </div>
            {games.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>등록된 경기가 없습니다</div>
            ) : games.map((g, i) => {
              const hw = (g.homeScore ?? 0) > (g.awayScore ?? 0);
              const aw = (g.awayScore ?? 0) > (g.homeScore ?? 0);
              return (
                <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 22px", borderBottom: i < games.length - 1 ? "1px solid #f8fafc" : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, flexWrap: "wrap" }}>
                      <span style={{ color: hw ? "#0ab07a" : "#475569" }}>{g.homeTeam.name}</span>
                      <span style={{ color: "#94a3b8", fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>{g.homeScore} : {g.awayScore}</span>
                      <span style={{ color: aw ? "#0ab07a" : "#475569" }}>{g.awayTeam.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {new Date(g.gameDate).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                    </div>
                  </div>
                  {g.priceApplied ? (
                    <span style={{ fontSize: 11, background: "#f0fdf4", color: "#0ab07a", border: "1px solid #bbf7d0", padding: "4px 10px", borderRadius: 20, fontWeight: 700, whiteSpace: "nowrap" }}>✅ 정산 완료</span>
                  ) : (
                    <button onClick={() => handleSettle(g.id)} disabled={settling === g.id}
                      style={{ fontSize: 11, background: "#eff6ff", color: "#1251aa", border: "1px solid #bfdbfe", padding: "6px 12px", borderRadius: 20, fontWeight: 700, cursor: settling === g.id ? "wait" : "pointer", whiteSpace: "nowrap", fontFamily: "inherit" }}>
                      {settling === g.id ? "정산 중..." : "주가 정산"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 주가 수정 탭 ── */}
      {tab === "price" && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>💹 팀 주가 강제 수정</h2>
            <form onSubmit={handlePriceSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>팀 선택</label>
                <select required value={priceForm.teamId} onChange={e => setPriceForm(f => ({ ...f, teamId: e.target.value }))} className="input-base" style={{ padding: "9px 10px" }}>
                  <option value="">선택</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} (현재: {Math.round(t.currentPrice).toLocaleString()}원)</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>새 주가 (원)</label>
                <input type="number" required min="100" value={priceForm.price} onChange={e => setPriceForm(f => ({ ...f, price: e.target.value }))} placeholder="예: 15000" className="input-base" />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: "12px", fontSize: 14, borderRadius: 9 }}>주가 수정</button>
            </form>
            {priceResult && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, fontSize: 13 }}>
                <strong style={{ color: "#0ab07a" }}>✅ 수정 완료</strong><br />
                {Math.round(priceResult.prevClose).toLocaleString()} → {Math.round(priceResult.newClose).toLocaleString()}원
                ({priceResult.changeRate >= 0 ? "+" : ""}{(priceResult.changeRate * 100).toFixed(2)}%)
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 유저 관리 탭 ── */}
      {tab === "users" && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>👤 유저 목록 ({userTotal}명)</span>
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="닉네임/이메일 검색"
              className="input-base" style={{ width: 200, padding: "6px 10px" }} />
            <button onClick={fetchUsers} className="btn-primary" style={{ padding: "6px 12px", fontSize: 12, borderRadius: 7 }}>검색</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["닉네임", "이메일", "역할", "상태", "총 자산", "가입일", "관리"].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 600 }}>{u.nickname}</td>
                    <td style={{ padding: "11px 14px", color: "#64748b" }}>{u.email}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                        background: u.role === "admin" ? "#fee2e2" : "#f1f5f9",
                        color: u.role === "admin" ? "#dc2626" : "#64748b" }}>
                        {u.role === "admin" ? "관리자" : "유저"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                        background: u.status === "active" ? "#f0fdf4" : u.status === "deleted" ? "#f1f5f9" : "#fff7ed",
                        color: u.status === "active" ? "#0ab07a" : u.status === "deleted" ? "#94a3b8" : "#d97706" }}>
                        {u.status === "active" ? "활성" : u.status === "deleted" ? "탈퇴" : "비활성"}
                      </span>
                    </td>
                    <td style={{ padding: "11px 14px", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {parseInt(u.totalAsset).toLocaleString()}원
                    </td>
                    <td style={{ padding: "11px 14px", color: "#94a3b8", fontSize: 11 }}>
                      {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td style={{ padding: "11px 14px" }}>
                      {u.status === "deleted" ? (
                        <span style={{ fontSize: 11, color: "#cbd5e1" }}>-</span>
                      ) : (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={() => handleUserRoleToggle(u)} disabled={userActionLoading === u.id}
                            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0",
                              background: "white", color: "#475569", cursor: "pointer", fontWeight: 600 }}>
                            {u.role === "admin" ? "일반으로" : "관리자로"}
                          </button>
                          <button onClick={() => handleUserStatusToggle(u)} disabled={userActionLoading === u.id}
                            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #e2e8f0",
                              background: "white", color: "#d97706", cursor: "pointer", fontWeight: 600 }}>
                            {u.status === "active" ? "비활성화" : "활성화"}
                          </button>
                          <button onClick={() => handleUserDelete(u)} disabled={userActionLoading === u.id}
                            style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #fecaca",
                              background: "white", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>
                            탈퇴 처리
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 공지사항 탭 ── */}
      {tab === "notice" && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>📢 공지사항 등록</h2>
            <form onSubmit={handleNoticeSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>제목</label>
                <input type="text" required value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} placeholder="공지 제목" className="input-base" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>내용</label>
                <textarea required value={noticeForm.content} onChange={e => setNoticeForm(f => ({ ...f, content: e.target.value }))} rows={6}
                  style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", color: "#0f172a" }}
                  onFocus={e => e.target.style.borderColor = "#1251aa"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={noticeForm.isPinned} onChange={e => setNoticeForm(f => ({ ...f, isPinned: e.target.checked }))} />
                상단 고정
              </label>
              <button type="submit" className="btn-primary" style={{ padding: "12px", fontSize: 14, borderRadius: 9 }}>등록</button>
            </form>
          </div>
        </div>
      )}

      {/* ── 거래 세션 탭 ── */}
      {tab === "session" && (
        <div style={{ maxWidth: 520 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🕐 거래 세션 수동 설정</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>기본 거래일은 매주 월요일입니다. 특별 이벤트 시 수동으로 세션을 추가할 수 있습니다.</p>
            <form onSubmit={handleSessionSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>거래 시작 (UTC)</label>
                <input type="datetime-local" required value={sessionForm.openAt} onChange={e => setSessionForm(f => ({ ...f, openAt: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>거래 종료 (UTC)</label>
                <input type="datetime-local" required value={sessionForm.closeAt} onChange={e => setSessionForm(f => ({ ...f, closeAt: e.target.value }))} className="input-base" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 5 }}>설명 (선택)</label>
                <input type="text" value={sessionForm.description} onChange={e => setSessionForm(f => ({ ...f, description: e.target.value }))} placeholder="예: 특별 이벤트 거래 세션" className="input-base" />
              </div>
              <button type="submit" className="btn-primary" style={{ padding: "12px", fontSize: 14, borderRadius: 9 }}>세션 등록</button>
            </form>
          </div>
        </div>
      )}

      {/* ── v9 동기화 탭 ── */}
      {tab === "sync" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>

          {/* 일일 업데이트 일괄 실행 (수정안: 매일 23:59 자동 실행되는 것과 동일 파이프라인) */}
          <div style={{ background: "linear-gradient(135deg,#0f172a,#1251aa)", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4, color: "white" }}>🌙 일일 업데이트 실행</h2>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", marginBottom: 14 }}>
              경기 결과 → 순위 갱신 → 자산 재계산 → AI 예측 갱신을 한 번에 실행합니다. (매일 한국시간 23:59에 자동 실행되는 것과 동일)
            </p>
            <button onClick={handleDailyUpdate} disabled={dailyRunning} style={{
              padding: "11px 22px", borderRadius: 9, border: "none", fontFamily: "inherit",
              background: dailyRunning ? "rgba(255,255,255,0.3)" : "white",
              color: dailyRunning ? "rgba(255,255,255,0.6)" : "#1251aa",
              fontWeight: 800, fontSize: 13, cursor: dailyRunning ? "wait" : "pointer",
            }}>
              {dailyRunning ? "실행 중..." : "🚀 지금 일일 업데이트 실행"}
            </button>
            {dailyResult && (
              <div style={{ marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {dailyResult.success ? "✅" : "⚠️"} {dailyResult.message}
              </div>
            )}
          </div>

          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "22px" }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🔗 개별 단계 실행</h2>
            <p style={{ fontSize: 12, color: "#64748b", marginBottom: 20 }}>
              경기 데이터·팀 순위·AI 예측을 단계별로 개별 실행하거나 유저 자산을 강제 재계산합니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

              {/* 경기 동기화 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>⚾ 오늘 경기 동기화</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>Provider 체인(kbo→tving→mock)에서 오늘 경기 수집 후 DB 저장</div>
                </div>
                <button onClick={handleAutoSync} disabled={autoSyncing} style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", fontFamily: "inherit",
                  background: autoSyncing ? "#e2e8f0" : "#1251aa", color: autoSyncing ? "#94a3b8" : "white",
                  fontWeight: 700, fontSize: 12, cursor: autoSyncing ? "wait" : "pointer", whiteSpace: "nowrap",
                }}>
                  {autoSyncing ? "동기화 중..." : "경기 동기화"}
                </button>
              </div>

              {/* 팀 순위 동기화 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🏆 팀 순위 동기화</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>네이버 스포츠에서 KBO 팀 순위·승패·게임차 수집 후 team_stats 갱신</div>
                </div>
                <button onClick={handleStandingsSync} disabled={standingsSyncing} style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", fontFamily: "inherit",
                  background: standingsSyncing ? "#e2e8f0" : "#0ab07a", color: standingsSyncing ? "#94a3b8" : "white",
                  fontWeight: 700, fontSize: 12, cursor: standingsSyncing ? "wait" : "pointer", whiteSpace: "nowrap",
                }}>
                  {standingsSyncing ? "동기화 중..." : "순위 동기화"}
                </button>
              </div>

              {/* 종료 경기 일괄 정산 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>💹 경기 종료 자동 정산</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>경기 동기화 실행 시 FINAL 상태 경기는 자동 정산됩니다 (별도 버튼 불필요)</div>
                </div>
                <span style={{ fontSize: 11, background: "#ecfdf5", color: "#0ab07a", padding: "5px 12px", borderRadius: 8, fontWeight: 600 }}>경기 동기화에 포함</span>
              </div>

              {/* 가격 재계산 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🔁 유저 자산 강제 재계산</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>모든 유저의 총 자산·수익률을 현재 주가 기준으로 즉시 재계산</div>
                </div>
                <button onClick={handlePriceRecalc} disabled={priceRecalcing} style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", fontFamily: "inherit",
                  background: priceRecalcing ? "#e2e8f0" : "#d97706", color: priceRecalcing ? "#94a3b8" : "white",
                  fontWeight: 700, fontSize: 12, cursor: priceRecalcing ? "wait" : "pointer", whiteSpace: "nowrap",
                }}>
                  {priceRecalcing ? "계산 중..." : "자산 재계산"}
                </button>
              </div>

              {/* AI 예측 재생성 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>🤖 AI 예측 재생성</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>순위·최근5경기·승률·게임차·주가변화 기준으로 팀별 AI Score/추천등급/코멘트 재계산</div>
                </div>
                <button onClick={handleAiRegenerate} disabled={aiRegenerating} style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", fontFamily: "inherit",
                  background: aiRegenerating ? "#e2e8f0" : "#7c3aed", color: aiRegenerating ? "#94a3b8" : "white",
                  fontWeight: 700, fontSize: 12, cursor: aiRegenerating ? "wait" : "pointer", whiteSpace: "nowrap",
                }}>
                  {aiRegenerating ? "생성 중..." : "AI 예측 재생성"}
                </button>
              </div>
              {aiResult && (
                <div style={{ padding: "10px 14px", background: aiResult.success ? "#f0fdf4" : "#fff5f5", borderRadius: 8, fontSize: 11.5, color: aiResult.success ? "#0ab07a" : "#e53e3e" }}>
                  {aiResult.success ? `✅ ${aiResult.count}팀 AI 예측 갱신 완료` : `⚠️ ${aiResult.error}`}
                </div>
              )}

              {/* 가격 재정렬 */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#f8fafc", borderRadius: 10 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>⚖️ 순위 기준 가격 재정렬</div>
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>현재 승률 기준 공정가로 전체 팀 주가를 다시 맞춤 (승률 0.5=1만원 기준, ±승률차×2배 반영)</div>
                </div>
                <button onClick={handleRealign} disabled={realigning} style={{
                  padding: "9px 18px", borderRadius: 8, border: "none", fontFamily: "inherit",
                  background: realigning ? "#e2e8f0" : "#0891b2", color: realigning ? "#94a3b8" : "white",
                  fontWeight: 700, fontSize: 12, cursor: realigning ? "wait" : "pointer", whiteSpace: "nowrap",
                }}>
                  {realigning ? "정렬 중..." : "가격 재정렬"}
                </button>
              </div>
              {realignResult && (
                <div style={{ padding: "10px 14px", background: realignResult.ok ? "#f0fdf4" : "#fff5f5", borderRadius: 8, fontSize: 11.5, color: realignResult.ok ? "#0ab07a" : "#e53e3e" }}>
                  {realignResult.ok ? `✅ ${realignResult.count}팀 가격 재정렬 완료` : `⚠️ ${realignResult.error}`}
                </div>
              )}

            </div>

            {/* 동기화 결과 */}
            {syncResult && (
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 9, fontSize: 12 }}>
                <strong style={{ color: "#0ab07a" }}>✅ 경기 동기화 결과</strong>
                <div style={{ marginTop: 6, color: "#065f46" }}>
                  소스: {syncResult.usedSource} · 확인: {syncResult.totalGames}경기 · 신규 정산: {syncResult.newlyFinal}건
                  {syncResult.errors.length > 0 && <span style={{ color: "#dc2626" }}> · 오류: {syncResult.errors.length}건</span>}
                </div>
              </div>
            )}
            {standingsResult && (
              <div style={{ marginTop: 10, padding: "12px 14px", background: standingsResult.success ? "#f0fdf4" : "#fff5f5", border: `1px solid ${standingsResult.success ? "#bbf7d0" : "#fecaca"}`, borderRadius: 9, fontSize: 12 }}>
                <strong style={{ color: standingsResult.success ? "#0ab07a" : "#dc2626" }}>
                  {standingsResult.success ? "✅" : "❌"} 순위 동기화 결과
                </strong>
                <div style={{ marginTop: 6, color: "#475569" }}>
                  {standingsResult.success
                    ? `소스: ${standingsResult.provider} · ${standingsResult.teamCount}팀 갱신`
                    : standingsResult.message}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 11, color: "#92400e" }}>
            💡 <strong>Vercel Cron</strong>이 설정되어 있으면 매분 자동으로 경기 동기화가 실행됩니다.
            수동 버튼은 즉시 테스트하거나 긴급 동기화가 필요할 때 사용하세요.
          </div>
        </div>
      )}

      {/* ── 시즌 초기화 탭 ── */}
      {tab === "reset" && (
        <div style={{ maxWidth: 480 }}>
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px" }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#dc2626", marginBottom: 12 }}>⚠️ 시즌 초기화</h2>
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 9, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "#7f1d1d", lineHeight: 1.7 }}>
              <strong>초기화 시 삭제되는 데이터:</strong><br />
              • 모든 유저의 포트폴리오 (보유 주식)<br />
              • 모든 거래 내역<br />
              • 모든 주문 내역<br />
              • 모든 유저 현금 → 1,000만원으로 초기화<br />
              • 팀 보유자 수 → 0으로 초기화<br />
              <br />
              <strong>유지되는 데이터:</strong> 유저 계정, 팀 정보, 주가 히스토리, 게시글
            </div>
            <button onClick={handleReset} style={{
              width: "100%", padding: "14px", border: "none", borderRadius: 9,
              background: "#dc2626", color: "white", fontWeight: 800, fontSize: 15, cursor: "pointer", fontFamily: "inherit",
            }}>
              🔄 시즌 초기화 실행
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
