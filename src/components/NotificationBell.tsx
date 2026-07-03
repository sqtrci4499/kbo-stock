"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useSSE } from "./useSSE";

interface Notif {
  id: string; type: string; title: string; message: string;
  isRead: boolean; createdAt: string;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const [notifs, setNotifs]     = useState<Notif[]>([]);
  const [unread, setUnread]     = useState(0);
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/notifications?limit=15");
      const data = await res.json();
      setNotifs(data.notifications ?? []);
      setUnread(data.unreadCount   ?? 0);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (user) fetchNotifs(); }, [user]);

  // SSE 실시간 알림
  useSSE({
    onNotification: (data: any) => {
      setUnread(u => u + 1);
      setNotifs(n => [data, ...n].slice(0, 15));
    },
  });

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "PATCH" });
    setUnread(0);
    setNotifs(n => n.map(x => ({ ...x, isRead: true })));
  };

  if (!user) return null;

  const ICONS: Record<string, string> = {
    game_start: "⚾", game_end: "🏁", price_surge: "🔥",
    price_drop: "❄️", order_filled: "✅",
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => { setOpen(o => !o); if (!open) fetchNotifs(); }}
        style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: "4px 6px", borderRadius: 7, fontSize: 18 }}
        onMouseEnter={e => (e.currentTarget.style.background = "#f1f5f9")}
        onMouseLeave={e => (e.currentTarget.style.background = "none")}
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 0, right: 0,
            width: 16, height: 16, borderRadius: "50%",
            background: "#e53e3e", color: "white",
            fontSize: 9, fontWeight: 700,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>{unread > 9 ? "9+" : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: 320, maxHeight: 400, overflowY: "auto",
          background: "white", border: "1px solid #e2e8f0",
          borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
          zIndex: 100,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a" }}>알림 {unread > 0 && <span style={{ color: "#e53e3e" }}>({unread})</span>}</span>
            {unread > 0 && (
              <button onClick={markAllRead} style={{ fontSize: 11, color: "#1251aa", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                모두 읽음
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 12 }}>불러오는 중...</div>
          ) : notifs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>알림이 없습니다</div>
          ) : (
            notifs.map(n => (
              <div key={n.id} style={{
                padding: "11px 16px", borderBottom: "1px solid #f8fafc",
                background: n.isRead ? "transparent" : "#eff6ff",
              }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ICONS[n.type] ?? "📢"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{n.title}</div>
                    <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{n.message}</div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 3 }}>
                      {new Date(n.createdAt).toLocaleString("ko-KR")}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
