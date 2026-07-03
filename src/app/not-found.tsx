import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>⚾</div>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>404</h1>
        <p style={{ fontSize: 16, color: "#64748b", marginBottom: 6 }}>페이지를 찾을 수 없습니다</p>
        <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 28 }}>공이 경기장 밖으로 날아갔어요</p>
        <Link href="/">
          <div style={{ display: "inline-block", background: "#1251aa", color: "white", fontWeight: 700, fontSize: 14, padding: "12px 28px", borderRadius: 9, cursor: "pointer" }}>
            홈으로 돌아가기
          </div>
        </Link>
      </div>
    </div>
  );
}
