"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Post {
  id: string; title: string; authorNickname: string;
  likes: number; views: number; commentCount: number;
  createdAt: string; teamShortName?: string;
}

export default function BoardPage() {
  const { user }  = useAuth();
  const [posts, setPosts]   = useState<Post[]>([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/posts?page=${page}&limit=20`)
      .then(r => r.json())
      .then(d => { setPosts(d.posts ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>💬 커뮤니티</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>전체 {total}개 게시글</p>
        </div>
        {user && (
          <Link href="/board/write">
            <div style={{ background: "#1251aa", color: "white", fontWeight: 700, fontSize: 13, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
              글쓰기
            </div>
          </Link>
        )}
      </div>

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        {/* 테이블 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 60px 60px 80px", padding: "9px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
          {["제목", "작성자", "댓글", "좋아요", "작성일"].map(h => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textAlign: h === "제목" ? "left" : "center" }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>아직 게시글이 없습니다</div>
            {user && <Link href="/board/write"><div style={{ display: "inline-block", background: "#1251aa", color: "white", padding: "8px 16px", borderRadius: 7, fontSize: 13, fontWeight: 700 }}>첫 글 작성하기</div></Link>}
          </div>
        ) : posts.map((p, i) => (
          <Link key={p.id} href={`/board/${p.id}`} style={{ textDecoration: "none", display: "block" }}>
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 80px 60px 60px 80px",
              padding: "12px 16px", alignItems: "center",
              borderBottom: i < posts.length - 1 ? "1px solid #f8fafc" : "none",
              transition: "background 0.12s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.teamShortName && <span style={{ fontSize: 10, background: "#eff6ff", color: "#1251aa", padding: "1px 5px", borderRadius: 4, marginRight: 6, fontWeight: 700 }}>{p.teamShortName}</span>}
                  {p.title}
                </div>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>{p.authorNickname}</div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>💬 {p.commentCount}</div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>❤️ {p.likes}</div>
              <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
                {new Date(p.createdAt).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" })}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* 페이지네이션 */}
      {total > 20 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
          {Array.from({ length: Math.ceil(total / 20) }, (_, i) => i + 1).slice(
            Math.max(0, page - 3), Math.min(Math.ceil(total / 20), page + 2)
          ).map(p => (
            <button key={p} onClick={() => setPage(p)} style={{
              width: 32, height: 32, borderRadius: 7, border: "1.5px solid",
              borderColor: p === page ? "#1251aa" : "#e2e8f0",
              background: p === page ? "#eff6ff" : "white",
              color: p === page ? "#1251aa" : "#64748b",
              fontWeight: p === page ? 700 : 500, cursor: "pointer", fontSize: 13,
            }}>{p}</button>
          ))}
        </div>
      )}
    </div>
  );
}
