"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  rate: number;
  size?: "xs" | "sm" | "md" | "lg";
  animate?: boolean;
}

export default function PriceChangeBadge({ rate, size = "md", animate = false }: Props) {
  const prevRate = useRef(rate);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (!animate) return;
    if (rate !== prevRate.current) {
      setFlash(rate > prevRate.current ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 600);
      prevRate.current = rate;
      return () => clearTimeout(t);
    }
  }, [rate, animate]);

  const isUp   = rate > 0;
  const isFlat = rate === 0;
  const sign   = isUp ? "+" : "";
  const pct    = (Math.abs(rate) * 100).toFixed(2);

  const sizeMap = {
    xs: { fontSize: 10, padding: "1px 5px" },
    sm: { fontSize: 11, padding: "2px 6px" },
    md: { fontSize: 12, padding: "3px 8px" },
    lg: { fontSize: 14, padding: "4px 10px" },
  };

  const s = sizeMap[size];

  const style: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 2,
    borderRadius: 5, fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
    fontSize: s.fontSize,
    padding: s.padding,
    whiteSpace: "nowrap",
    ...(isFlat
      ? { background: "#f1f5f9", color: "#64748b" }
      : isUp
      ? { background: flash === "up" ? "#bbf7d0" : "#ecfdf5", color: "#0ab07a", transition: "background 0.3s" }
      : { background: flash === "down" ? "#fecaca" : "#fff5f5", color: "#e53e3e", transition: "background 0.3s" }),
  };

  return (
    <span style={style}>
      {isFlat ? "0.00%" : `${isUp ? "▲" : "▼"} ${sign}${pct}%`}
    </span>
  );
}
