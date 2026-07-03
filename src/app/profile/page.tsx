"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import TeamLogo from "@/components/TeamLogo";

interface Trade {
  id: string; tradeType: string; price: number; quantity: number;
  totalAmount: string; createdAt: string;
  teamName: string; teamShortName: string; logoEmoji: string; logoUrl?: string | null; colorPrimary: string;
}

type ProfileTab = "trades" | "settings";

export default function ProfilePage() {
  const { user, loading, refresh, logout } = useAuth();
  const router = useRouter();
  const [tab, setTab]     = useState<ProfileTab>("trades");

  // 거래내역
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [tradeTotal, setTradeTotal] = useState(0);
  const [tradePage, setTradePage]   = useState(1);
  const [tradeLoading, setTradeLoading] = useState(false);

  // 설정 폼
  const [nickname, setNickname]         = useState("");
  const [currentPw, setCurrentPw]       = useState("");
  const [newPw, setNewPw]               = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [settingMsg, setSettingMsg]     = useState<{ type: "ok"|"err"; text: string } | null>(null);
  const [settingLoading, setSettingLoading] = useState(false);

  // 회원 탈퇴
  const [deletePw, setDeletePw]           = useState("");
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteMsg, setDeleteMsg]         = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    if (user) setNickname(user.nickname);
  }, [user, loading, router]);

  const fetchTrades = useCallback(() => {
    if (!user) return;
    setTradeLoading(true);
    fetch(`/api/trades?page=${tradePage}&limit=20`)
      .then(r => r.json())
      .then(d => { setTrades(d.trades ?? []); setTradeTotal(d.total ?? 0); })
      .finally(() => setTradeLoading(false));
  }, [user, tradePage]);

  useEffect(() => { if (tab === "trades") fetchTrades(); }, [tab, fetchTrades]);

  const handleNicknameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingLoading(true); setSettingMsg(null);
    try {
      const res  = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettingMsg({ type: "ok", text: "닉네임이 변경되었습니다." });
      await refresh();
    } catch (e: unknown) {
      setSettingMsg({ type: "err", text: e instanceof Error ? e.message : "오류 발생" });
    } finally { setSettingLoading(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw !== newPwConfirm) { setSettingMsg({ type: "err", text: "새 비밀번호가 일치하지 않습니다." }); return; }
    setSettingLoading(true); setSettingMsg(null);
    try {
      const res  = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSettingMsg({ type: "ok", text: "비밀번호가 변경되었습니다." });
      setCurrentPw(""); setNewPw(""); setNewPwConfirm("");
    } catch (e: unknown) {
      setSettingMsg({ type: "err", text: e instanceof Error ? e.message : "오류 발생" });
    } finally { setSettingLoading(false); }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteLoading(true); setDeleteMsg(null);
    try {
      const res  = await fetch("/api/auth/delete-account", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePw }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await logout();
      router.push("/login");
    } catch (e: unknown) {
      setDeleteMsg(e instanceof Error ? e.message : "오류가 발생했습니다.");
      setDeleteLoading(false);
    }
  };

  if (loading || !user) return null;

  const totalPages = Math.ceil(tradeTotal / 20);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", paddingBottom: 80 }}>
      {/* 프로필 헤더 */}
      <div style={{ background: "linear-gradient(135deg,#0f172a,#1251aa)", borderRadius: 16, padding: "24px 28px", marginBottom: 20, display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 900, color: "white", flexShrink: 0 }}>
          {user.nickname[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "white" }}>{user.nickname}</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{user.email}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>총 자산</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "white", fontVariantNumeric: "tabular-nums" }}>
            {parseInt(user.totalAsset).toLocaleString()}원
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: user.profitRate >= 0 ? "#86efac" : "#fca5a5", marginTop: 2 }}>
            {user.profitRate >= 0 ? "▲ +" : "▼ "}{(user.profitRate * 100).toFixed(2)}%
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
        {[{ k: "trades" as ProfileTab, label: "📋 거래내역" }, { k: "settings" as ProfileTab, label: "⚙️ 계정 설정" }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
            border: "1.5px solid", fontFamily: "inherit",
            borderColor: tab === t.k ? "#1251aa" : "#e2e8f0",
            background: tab === t.k ? "#eff6ff" : "white",
            color: tab === t.k ? "#1251aa" : "#64748b",
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── 거래내역 탭 ── */}
      {tab === "trades" && (
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>전체 {tradeTotal}건</span>
          </div>

          {tradeLoading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>불러오는 중...</div>
          ) : trades.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📭</div>
              <div>거래내역이 없습니다</div>
            </div>
          ) : (
            <>
              {/* 헤더 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 80px 80px 110px", padding: "8px 20px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                {["종목", "구분", "단가", "수량", "거래금액"].map((h, i) => (
                  <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: i === 0 ? "left" : "right" }}>{h}</div>
                ))}
              </div>

              {trades.map((tr, i) => (
                <div key={tr.id} style={{
                  display: "grid", gridTemplateColumns: "1fr 70px 80px 80px 110px",
                  alignItems: "center", padding: "11px 20px",
                  borderBottom: i < trades.length - 1 ? "1px solid #f8fafc" : "none",
                }}>
                  {/* 종목 */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <TeamLogo emoji={tr.logoEmoji} logoUrl={tr.logoUrl} color={tr.colorPrimary} size={30} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{tr.teamName}</div>
                      <div style={{ fontSize: 10, color: "#94a3b8" }}>
                        {new Date(tr.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                  {/* 구분 */}
                  <div style={{ textAlign: "right" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 5,
                      background: tr.tradeType === "buy" ? "#ecfdf5" : "#fff5f5",
                      color: tr.tradeType === "buy" ? "#0ab07a" : "#e53e3e",
                    }}>{tr.tradeType === "buy" ? "매수" : "매도"}</span>
                  </div>
                  {/* 단가 */}
                  <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", color: "#475569" }}>
                    {Math.round(tr.price).toLocaleString()}원
                  </div>
                  {/* 수량 */}
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "#0f172a" }}>
                    {tr.quantity.toLocaleString()}주
                  </div>
                  {/* 거래금액 */}
                  <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: tr.tradeType === "buy" ? "#e53e3e" : "#0ab07a" }}>
                    {tr.tradeType === "buy" ? "-" : "+"}{parseInt(tr.totalAmount).toLocaleString()}원
                  </div>
                </div>
              ))}

              {/* 페이지네이션 */}
              {totalPages > 1 && (
                <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "center", gap: 6 }}>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - tradePage) <= 2)
                    .map(p => (
                      <button key={p} onClick={() => setTradePage(p)} style={{
                        width: 32, height: 32, borderRadius: 7, border: "1.5px solid", fontFamily: "inherit",
                        borderColor: p === tradePage ? "#1251aa" : "#e2e8f0",
                        background: p === tradePage ? "#eff6ff" : "white",
                        color: p === tradePage ? "#1251aa" : "#64748b",
                        fontWeight: p === tradePage ? 700 : 500, cursor: "pointer", fontSize: 13,
                      }}>{p}</button>
                    ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 설정 탭 ── */}
      {tab === "settings" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {settingMsg && (
            <div style={{
              padding: "10px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600,
              background: settingMsg.type === "ok" ? "#f0fdf4" : "#fff5f5",
              color: settingMsg.type === "ok" ? "#0ab07a" : "#e53e3e",
              border: `1px solid ${settingMsg.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
            }}>{settingMsg.type === "ok" ? "✅ " : "⚠️ "}{settingMsg.text}</div>
          )}

          {/* 닉네임 변경 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>닉네임 변경</h2>
            <form onSubmit={handleNicknameChange} style={{ display: "flex", gap: 10 }}>
              <input type="text" value={nickname} onChange={e => setNickname(e.target.value)}
                placeholder="새 닉네임 (2~20자)" className="input-base" style={{ flex: 1 }} />
              <button type="submit" disabled={settingLoading || nickname === user.nickname}
                className="btn-primary" style={{ padding: "10px 18px", borderRadius: 8, fontSize: 13, whiteSpace: "nowrap" }}>
                변경
              </button>
            </form>
          </div>

          {/* 비밀번호 변경 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>비밀번호 변경</h2>
            <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { val: currentPw, set: setCurrentPw, label: "현재 비밀번호", placeholder: "현재 비밀번호 입력" },
                { val: newPw, set: setNewPw, label: "새 비밀번호", placeholder: "4자 이상" },
                { val: newPwConfirm, set: setNewPwConfirm, label: "새 비밀번호 확인", placeholder: "새 비밀번호 재입력" },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{f.label}</label>
                  <input type="password" value={f.val} onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder} required className="input-base" />
                </div>
              ))}
              <button type="submit" disabled={settingLoading} className="btn-primary" style={{ padding: "11px", borderRadius: 8, fontSize: 14, marginTop: 4 }}>
                {settingLoading ? "변경 중..." : "비밀번호 변경"}
              </button>
            </form>
          </div>

          {/* 계정 정보 */}
          <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 14 }}>계정 정보</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13 }}>
              {[
                { label: "이메일", value: user.email },
                { label: "역할", value: user.role === "admin" ? "관리자" : "일반 유저" },
                { label: "보유 현금", value: `${parseInt(user.cash).toLocaleString()}원` },
                { label: "총 자산", value: `${parseInt(user.totalAsset).toLocaleString()}원` },
                { label: "수익률", value: `${user.profitRate >= 0 ? "+" : ""}${(user.profitRate * 100).toFixed(2)}%` },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "#f8fafc", borderRadius: 7 }}>
                  <span style={{ color: "#64748b" }}>{s.label}</span>
                  <span style={{ fontWeight: 600, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 회원 탈퇴 */}
          <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: 14, padding: "20px 22px" }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: "#dc2626", marginBottom: 6 }}>회원 탈퇴</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", marginBottom: 14 }}>
              탈퇴 시 보유 종목은 모두 정리되며, 즉시 로그인이 불가능합니다. 거래 기록은 서비스 정합성을 위해 보존됩니다.
            </p>

            {!deleteConfirming ? (
              <button
                onClick={() => { setDeleteConfirming(true); setDeleteMsg(null); }}
                style={{ padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  color: "#dc2626", background: "#fff5f5", border: "1px solid #fecaca", cursor: "pointer" }}
              >
                회원 탈퇴하기
              </button>
            ) : (
              <form onSubmit={handleDeleteAccount} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {deleteMsg && (
                  <div style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>⚠️ {deleteMsg}</div>
                )}
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                  본인 확인을 위해 비밀번호를 입력해주세요.
                </label>
                <input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)}
                  placeholder="비밀번호" required className="input-base" />
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={deleteLoading}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, fontSize: 13, fontWeight: 700,
                      color: "white", background: "#dc2626", border: "none", cursor: "pointer" }}>
                    {deleteLoading ? "처리 중..." : "정말 탈퇴합니다"}
                  </button>
                  <button type="button" onClick={() => { setDeleteConfirming(false); setDeletePw(""); setDeleteMsg(null); }}
                    style={{ padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      color: "#64748b", background: "#f1f5f9", border: "none", cursor: "pointer" }}>
                    취소
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
