"use client";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>오류가 발생했습니다</h2>
        <p style={{ fontSize: 13, color: "#64748b", marginBottom: 24 }}>{error.message}</p>
        <button onClick={reset} style={{ background: "#1251aa", color: "white", fontWeight: 700, fontSize: 14, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
          다시 시도
        </button>
      </div>
    </div>
  );
}
