"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function WritePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [title, setTitle]   = useState("");
  const [content, setContent] = useState("");
  const [teamId, setTeamId]   = useState("");
  const [teams, setTeams]     = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    fetch("/api/teams").then(r => r.json()).then(d => Array.isArray(d) && setTeams(d));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) { setError("제목과 내용을 입력하세요."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/posts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, teamId: teamId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/board/${data.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류 발생");
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", paddingBottom: 80 }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", marginBottom: 20 }}>✏️ 글쓰기</h1>
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px 22px" }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>관련 팀 (선택)</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} className="input-base" style={{ padding: "9px 12px" }}>
              <option value="">전체 자유게시판</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>제목</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력하세요" maxLength={200} className="input-base" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>내용</label>
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="내용을 입력하세요" rows={12}
              style={{ width: "100%", background: "white", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", color: "#0f172a", outline: "none", resize: "vertical", lineHeight: 1.6 }}
              onFocus={e => e.target.style.borderColor = "#1251aa"}
              onBlur={e => e.target.style.borderColor = "#e2e8f0"}
            />
          </div>
          {error && <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#e53e3e", fontWeight: 600 }}>⚠️ {error}</div>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" onClick={() => router.back()}
              style={{ padding: "10px 20px", border: "1.5px solid #e2e8f0", borderRadius: 8, background: "white", color: "#64748b", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: "inherit" }}>
              취소
            </button>
            <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: "10px 24px", borderRadius: 8, fontSize: 14 }}>
              {submitting ? "등록 중..." : "게시글 등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
