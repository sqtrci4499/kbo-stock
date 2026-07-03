"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Notice {
  id: string; title: string; content: string; isPinned: boolean;
  views: number; createdAt: string; authorNickname: string;
}

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Notice | null>(null);

  useEffect(() => {
    fetch("/api/admin/notice")
      .then(r => r.json())
      .then(d => Array.isArray(d) && setNotices(d))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 80 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 20 }}>📢 공지사항</h1>

      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중...</div>
      ) : selected ? (
        // 상세 보기
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px 22px" }}>
          <button onClick={() => setSelected(null)} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer", marginBottom: 14, padding: 0, fontFamily: "inherit" }}>
            ← 목록으로
          </button>
          {selected.isPinned && (
            <span style={{ fontSize: 11, background: "#fef9c3", color: "#92400e", padding: "2px 8px", borderRadius: 4, fontWeight: 700, marginBottom: 10, display: "inline-block" }}>📌 공지</span>
          )}
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10, lineHeight: 1.4 }}>{selected.title}</h2>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
            {selected.authorNickname} · {new Date(selected.createdAt).toLocaleString("ko-KR")}
          </div>
          <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.8, whiteSpace: "pre-wrap", borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
            {selected.content}
          </div>
        </div>
      ) : (
        // 목록
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
          {notices.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>등록된 공지사항이 없습니다</div>
          ) : (
            notices.map((n, i) => (
              <div key={n.id}
                onClick={() => setSelected(n)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "14px 18px",
                  borderBottom: i < notices.length - 1 ? "1px solid #f8fafc" : "none",
                  cursor: "pointer", transition: "background 0.12s",
                  background: n.isPinned ? "#fffbeb" : "transparent",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = n.isPinned ? "#fef3c7" : "#f8fafc")}
                onMouseLeave={e => (e.currentTarget.style.background = n.isPinned ? "#fffbeb" : "transparent")}
              >
                {n.isPinned && (
                  <span style={{ fontSize: 11, background: "#fde68a", color: "#92400e", padding: "2px 7px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>공지</span>
                )}
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
                <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
                  {new Date(n.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
