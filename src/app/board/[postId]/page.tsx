"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Post {
  id: string; title: string; content: string; authorNickname: string;
  authorId: string; likes: number; views: number; createdAt: string;
  teamShortName?: string; teamId?: string;
}
interface Comment {
  id: string; content: string; authorNickname: string; authorId: string;
  likes: number; createdAt: string;
}

export default function PostDetailPage() {
  const { postId }  = useParams<{ postId: string }>();
  const { user }    = useAuth();
  const router      = useRouter();
  const [post, setPost]       = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [liked, setLiked]     = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/posts/${postId}`).then(r => r.json()).then(d => !d.error && setPost(d));
    fetch(`/api/posts/${postId}/comments`).then(r => r.json()).then(d => Array.isArray(d) && setComments(d));
  }, [postId]);

  const handleLike = async () => {
    if (!user) { router.push("/login"); return; }
    const res = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
    const data = await res.json();
    setLiked(data.liked);
    setPost(p => p ? { ...p, likes: data.likes } : p);
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { router.push("/login"); return; }
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res  = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (res.ok) {
        setNewComment("");
        const data = await fetch(`/api/posts/${postId}/comments`).then(r => r.json());
        if (Array.isArray(data)) setComments(data);
      }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!confirm("게시글을 삭제하시겠습니까?")) return;
    await fetch(`/api/posts/${postId}`, { method: "DELETE" });
    router.push("/board");
  };

  if (!post) return <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "#94a3b8" }}>불러오는 중...</div>;

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 80 }}>
      <Link href="/board" style={{ color: "#94a3b8", fontSize: 12, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
        ← 커뮤니티로
      </Link>

      {/* 게시글 본문 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px 22px", marginBottom: 16 }}>
        {post.teamShortName && (
          <span style={{ fontSize: 11, background: "#eff6ff", color: "#1251aa", padding: "2px 8px", borderRadius: 4, fontWeight: 700, marginBottom: 10, display: "inline-block" }}>{post.teamShortName}</span>
        )}
        <h1 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 10, lineHeight: 1.4 }}>{post.title}</h1>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#94a3b8", marginBottom: 20, flexWrap: "wrap" }}>
          <span>✍️ {post.authorNickname}</span>
          <span>👀 {post.views}</span>
          <span>❤️ {post.likes}</span>
          <span>{new Date(post.createdAt).toLocaleString("ko-KR")}</span>
          {(user?.id === post.authorId || user?.role === "admin") && (
            <button onClick={handleDelete} style={{ color: "#e53e3e", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12, padding: 0, fontFamily: "inherit" }}>삭제</button>
          )}
        </div>
        <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.75, whiteSpace: "pre-wrap", borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
          {post.content}
        </div>
        <div style={{ marginTop: 20, display: "flex", justifyContent: "center" }}>
          <button onClick={handleLike} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "8px 20px",
            border: `1.5px solid ${liked ? "#e53e3e" : "#e2e8f0"}`,
            borderRadius: 20, background: liked ? "#fff5f5" : "white",
            color: liked ? "#e53e3e" : "#64748b", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit"
          }}>
            ❤️ {post.likes}
          </button>
        </div>
      </div>

      {/* 댓글 */}
      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>댓글 {comments.length}개</span>
        </div>
        {comments.map(c => (
          <div key={c.id} style={{ padding: "14px 20px", borderBottom: "1px solid #f8fafc" }}>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1251aa", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {c.authorNickname[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>{c.authorNickname}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(c.createdAt).toLocaleString("ko-KR")}</span>
                </div>
                <div style={{ fontSize: 13, color: "#0f172a", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{c.content}</div>
              </div>
            </div>
          </div>
        ))}

        {/* 댓글 작성 */}
        <div style={{ padding: "14px 20px" }}>
          {user ? (
            <form onSubmit={handleComment} style={{ display: "flex", gap: 8 }}>
              <textarea value={newComment} onChange={e => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요" rows={2}
                style={{ flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", color: "#0f172a" }}
                onFocus={e => e.target.style.borderColor = "#1251aa"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
              />
              <button type="submit" disabled={submitting || !newComment.trim()} className="btn-primary" style={{ padding: "0 16px", borderRadius: 8, fontSize: 13, alignSelf: "stretch" }}>
                등록
              </button>
            </form>
          ) : (
            <Link href="/login" style={{ textDecoration: "none" }}>
              <div style={{ padding: "10px 16px", border: "1.5px dashed #e2e8f0", borderRadius: 8, color: "#94a3b8", fontSize: 13, textAlign: "center" }}>
                댓글을 작성하려면 로그인하세요
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
