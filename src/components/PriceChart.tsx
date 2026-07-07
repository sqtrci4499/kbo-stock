"use client";
import { useEffect, useRef, useState, useCallback } from "react";

interface PricePoint {
  date: string; open: number; high: number; low: number; close: number; volume: number;
  changeRate?: number;
}

interface Props { teamId: string; teamColor: string; }

// 3개월(90일) 옵션은 아직 실 데이터가 90일치 쌓이지 않아 30일과 동일하게 보여서 제거함.
// 데이터가 충분히 쌓이면(2026년 10월경 이후) 다시 추가 검토.
const PERIODS = [
  { label: "7일",   days: 7  },
  { label: "1개월", days: 30 },
];

export default function PriceChart({ teamId, teamColor }: Props) {
  const [prices, setPrices]     = useState<PricePoint[]>([]);
  const [period, setPeriod]     = useState(30);
  const [loading, setLoading]   = useState(true);
  const [hovered, setHovered]   = useState<{ point: PricePoint; x: number } | null>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const volRef     = useRef<HTMLCanvasElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);

  const fetchPrices = useCallback(() => {
    setLoading(true);
    fetch(`/api/teams/${teamId}/prices?days=${period}`)
      .then(r => r.json())
      .then(data => { setPrices(Array.isArray(data) ? data : []); })
      .catch(() => setPrices([]))
      .finally(() => setLoading(false));
  }, [teamId, period]);

  useEffect(() => { fetchPrices(); }, [fetchPrices]);

  // 메인 차트 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length < 2) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const closes = prices.map(p => p.close);
    const minC   = Math.min(...closes) * 0.988;
    const maxC   = Math.max(...closes) * 1.012;
    const range  = maxC - minC || 1;
    const PL = 56, PR = 12, PT = 10, PB = 24;
    const cW = W - PL - PR;
    const cH = H - PT - PB;

    const toX = (i: number) => PL + (i / (prices.length - 1)) * cW;
    const toY = (v: number) => PT + ((maxC - v) / range) * cH;

    // 그리드
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = PT + (cH / 4) * i;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
      const val = maxC - (range / 4) * i;
      ctx.fillStyle = "#94a3b8";
      ctx.font = `10px monospace`;
      ctx.textAlign = "right";
      ctx.fillText(Math.round(val).toLocaleString(), PL - 4, y + 4);
    }
    ctx.setLineDash([]);

    // 등락 방향 판단
    const isUp = closes[closes.length - 1] >= closes[0];
    const lineColor = isUp ? "#0ab07a" : "#e53e3e";

    // 영역 그라디언트
    const grad = ctx.createLinearGradient(0, PT, 0, H - PB);
    grad.addColorStop(0, isUp ? "rgba(10,176,122,0.15)" : "rgba(229,62,62,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");

    ctx.beginPath();
    ctx.moveTo(toX(0), toY(prices[0].close));
    for (let i = 1; i < prices.length; i++) {
      ctx.lineTo(toX(i), toY(prices[i].close));
    }
    ctx.lineTo(toX(prices.length - 1), H - PB);
    ctx.lineTo(toX(0), H - PB);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 메인 라인
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(prices[0].close));
    for (let i = 1; i < prices.length; i++) {
      ctx.lineTo(toX(i), toY(prices[i].close));
    }
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.stroke();

    // 호버 크로스헤어
    if (hovered) {
      const idx = prices.findIndex(p => p.date === hovered.point.date);
      if (idx >= 0) {
        const x = toX(idx);
        const y = toY(hovered.point.close);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, H - PB); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W - PR, y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = lineColor;
        ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      }
    }

    // X축 날짜
    ctx.textAlign = "center";
    ctx.fillStyle = "#94a3b8";
    ctx.font = "10px sans-serif";
    const step = Math.max(1, Math.floor(prices.length / 5));
    prices.forEach((p, i) => {
      if (i % step === 0 || i === prices.length - 1) {
        const d = new Date(p.date);
        ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, toX(i), H - 6);
      }
    });
  }, [prices, hovered]);

  // 거래량 차트
  useEffect(() => {
    const canvas = volRef.current;
    if (!canvas || prices.length < 2) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const PL = 56, PR = 12;
    const vols  = prices.map(p => p.volume || 0);
    const maxV  = Math.max(...vols) || 1;
    const barW  = Math.max(1, (W - PL - PR) / prices.length - 1);

    prices.forEach((p, i) => {
      const x = PL + (i / (prices.length - 1)) * (W - PL - PR) - barW / 2;
      const h = ((p.volume || 0) / maxV) * H * 0.85;
      const isUpBar = i === 0 ? true : p.close >= prices[i - 1].close;
      ctx.fillStyle = isUpBar ? "rgba(10,176,122,0.4)" : "rgba(229,62,62,0.4)";
      ctx.fillRect(x, H - h, barW, h);
    });
  }, [prices]);

  // 마우스 이벤트
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || prices.length < 2) return;
    const rect = canvas.getBoundingClientRect();
    const x    = e.clientX - rect.left;
    const PL = 56, PR = 12;
    const cW = rect.width - PL - PR;
    const idx = Math.round(((x - PL) / cW) * (prices.length - 1));
    const clamped = Math.max(0, Math.min(prices.length - 1, idx));
    setHovered({ point: prices[clamped], x });
  };

  const firstClose = prices[0]?.close ?? 0;
  const lastClose  = prices[prices.length - 1]?.close ?? 0;
  const totalChg   = firstClose > 0 ? (lastClose - firstClose) / firstClose : 0;
  const isUp       = totalChg >= 0;

  return (
    <div style={{ userSelect: "none" }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: 12 }}>
          {hovered ? (
            <span style={{ color: "#475569" }}>
              <strong style={{ color: "#0f172a" }}>{new Date(hovered.point.date).toLocaleDateString("ko-KR")}</strong>
              {" "}·{" "}
              <strong style={{ color: isUp ? "#0ab07a" : "#e53e3e" }}>{Math.round(hovered.point.close).toLocaleString()}원</strong>
            </span>
          ) : (
            <span style={{ fontWeight: 700, color: isUp ? "#0ab07a" : "#e53e3e" }}>
              {period}일 {isUp ? "▲ +" : "▼ "}{(totalChg * 100).toFixed(2)}%
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {PERIODS.map(p => (
            <button key={p.days} onClick={() => setPeriod(p.days)} style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: period === p.days ? "1.5px solid #1251aa" : "1.5px solid #e2e8f0",
              background: period === p.days ? "#eff6ff" : "white",
              color: period === p.days ? "#1251aa" : "#64748b",
              transition: "all 0.15s",
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 메인 차트 */}
      <div ref={wrapRef} style={{ position: "relative", height: 200, background: "white", borderRadius: 8, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        {loading ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>
            <span style={{ animation: "pulse 1.5s infinite" }}>차트 로딩 중...</span>
          </div>
        ) : prices.length < 2 ? (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12 }}>
            데이터가 없습니다
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block", cursor: "crosshair" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          />
        )}
      </div>

      {/* 거래량 */}
      <div style={{ marginTop: 6, height: 44, background: "#fafafa", borderRadius: 6, border: "1px solid #f1f5f9", overflow: "hidden" }}>
        <canvas ref={volRef} style={{ width: "100%", height: "100%", display: "block" }} />
      </div>
      <div style={{ fontSize: 10, color: "#94a3b8", textAlign: "right", marginTop: 2 }}>거래량</div>
    </div>
  );
}
