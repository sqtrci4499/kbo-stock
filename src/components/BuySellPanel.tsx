"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

interface Props {
  teamId: string;
  teamName: string;
  currentPrice: number;
  availableShares?: number;
  onSuccess?: () => void;
}

interface TradeStatus { isOpen: boolean; reason: string; opensAt?: string; }

export default function BuySellPanel({ teamId, teamName, currentPrice, availableShares = 0, onSuccess }: Props) {
  const { user, refresh } = useAuth();
  const router = useRouter();
  const [side, setSide]         = useState<"buy" | "sell">("buy");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus | null>(null);

  // 거래 세션 상태 조회
  useEffect(() => {
    fetch("/api/trade-session").then(r => r.json()).then(setTradeStatus).catch(() => {});
    const iv = setInterval(() => {
      fetch("/api/trade-session").then(r => r.json()).then(setTradeStatus).catch(() => {});
    }, 60_000);
    return () => clearInterval(iv);
  }, []);

  const cash    = user ? parseInt(user.cash) : 0;
  const maxQty  = side === "buy" ? Math.floor(cash / Math.max(currentPrice, 1)) : availableShares;
  const total   = Math.round(currentPrice * quantity);
  const isBuy   = side === "buy";
  const activeColor = isBuy ? "#0ab07a" : "#e53e3e";

  const setQtyPct = (pct: number) => setQuantity(Math.max(1, Math.floor(maxQty * pct)));

  const handleSubmit = async () => {
    if (!user) { router.push("/login"); return; }
    if (quantity < 1 || quantity > maxQty) return;
    setLoading(true); setMsg(null);
    try {
      const res  = await fetch(`/api/orders/${side}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, quantity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMsg({ type: "ok", text: `${teamName} ${quantity}주 ${isBuy ? "매수" : "매도"} 완료!` });
      setQuantity(1);
      await refresh();
      onSuccess?.();
    } catch (e: unknown) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "오류 발생" });
    } finally { setLoading(false); }
  };

  // 거래 불가 상태
  const tradeBlocked = tradeStatus !== null && !tradeStatus.isOpen;

  return (
    <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
      {/* 매수/매도 탭 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        {(["buy", "sell"] as const).map(s => (
          <button key={s} onClick={() => { setSide(s); setQuantity(1); setMsg(null); }} style={{
            padding: "13px 0", border: "none", cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: "inherit",
            background: side === s ? (s === "buy" ? "#0ab07a" : "#e53e3e") : "#f8fafc",
            color: side === s ? "white" : "#94a3b8", transition: "all 0.15s",
          }}>
            {s === "buy" ? "매수" : "매도"}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {/* 거래 불가 배너 */}
        {tradeBlocked && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
            🔒 {tradeStatus!.reason}
            {tradeStatus!.opensAt && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 3, fontWeight: 500 }}>
                다음 거래: {new Date(tradeStatus!.opensAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
              </div>
            )}
          </div>
        )}

        {/* 현재가 */}
        <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>시장가</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{currentPrice.toLocaleString()}원</span>
        </div>

        {/* 수량 */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>수량</label>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>최대 {maxQty.toLocaleString()}주</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} style={{ width: 36, height: 36, borderRadius: 7, border: "1.5px solid #e2e8f0", background: "white", color: "#475569", fontSize: 16, cursor: "pointer", flexShrink: 0, fontWeight: 700, fontFamily: "inherit" }}>−</button>
            <input type="number" min={1} max={maxQty} value={quantity}
              onChange={e => setQuantity(Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1)))}
              style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 15, border: "1.5px solid #e2e8f0", borderRadius: 7, outline: "none", padding: "6px", fontFamily: "inherit", color: "#0f172a" }}
              onFocus={e => e.target.style.borderColor = activeColor}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"} />
            <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} style={{ width: 36, height: 36, borderRadius: 7, border: "1.5px solid #e2e8f0", background: "white", color: "#475569", fontSize: 16, cursor: "pointer", flexShrink: 0, fontWeight: 700, fontFamily: "inherit" }}>+</button>
          </div>
          <input type="range" min={1} max={Math.max(1, maxQty)} value={quantity}
            onChange={e => setQuantity(parseInt(e.target.value))}
            style={{ width: "100%", accentColor: activeColor, marginBottom: 8 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 5 }}>
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <button key={pct} onClick={() => setQtyPct(pct)} style={{
                padding: "5px 0", border: "1.5px solid #e2e8f0", borderRadius: 6, background: "white",
                color: "#64748b", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", transition: "all 0.12s",
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = activeColor; e.currentTarget.style.color = activeColor; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.color = "#64748b"; }}
              >
                {pct * 100}%
              </button>
            ))}
          </div>
        </div>

        {/* 예상 금액 */}
        <div style={{ background: isBuy ? "#f0fdf4" : "#fff5f5", borderRadius: 8, padding: "10px 14px", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>예상 {isBuy ? "매수" : "매도"}금액</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString()}원</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{isBuy ? "가용 현금" : "보유 수량"}</span>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{isBuy ? `${cash.toLocaleString()}원` : `${availableShares}주`}</span>
          </div>
        </div>

        {/* 메시지 */}
        {msg && (
          <div style={{
            borderRadius: 7, padding: "9px 12px", marginBottom: 10, fontSize: 12, fontWeight: 600,
            background: msg.type === "ok" ? "#f0fdf4" : "#fff5f5",
            color: msg.type === "ok" ? "#0ab07a" : "#e53e3e",
            border: `1px solid ${msg.type === "ok" ? "#bbf7d0" : "#fecaca"}`,
          }}>
            {msg.type === "ok" ? "✅ " : "⚠️ "}{msg.text}
          </div>
        )}

        {/* 실행 버튼 */}
        <button onClick={handleSubmit}
          disabled={loading || quantity < 1 || quantity > maxQty || !user || tradeBlocked}
          style={{
            width: "100%", padding: "14px 0", borderRadius: 9, border: "none", fontFamily: "inherit",
            fontWeight: 900, fontSize: 15, cursor: (loading || tradeBlocked) ? "not-allowed" : "pointer",
            background: (loading || quantity < 1 || quantity > maxQty || !user || tradeBlocked)
              ? "#e2e8f0" : activeColor,
            color: (loading || quantity < 1 || quantity > maxQty || !user || tradeBlocked)
              ? "#94a3b8" : "white",
            transition: "all 0.15s",
          }}>
          {loading ? "처리 중..." : !user ? "로그인 후 거래 가능" : tradeBlocked ? "🔒 거래 불가 (월요일만)" : `${quantity.toLocaleString()}주 ${isBuy ? "매수하기" : "매도하기"}`}
        </button>
      </div>
    </div>
  );
}
