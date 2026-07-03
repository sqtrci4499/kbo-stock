"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login } = useAuth();
  const router    = useRouter();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const doLogin = async (e: string, p: string) => {
    setError(""); setLoading(true);
    try {
      await login(e, p);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#1251aa,#0f3f87)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 14px" }}>⚾</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px" }}>KBO STOCK</h1>
          <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 5 }}>KBO 구단 가상 투자 플랫폼</p>
        </div>

        {/* 로그인 폼 */}
        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "20px 18px" }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>이메일</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="input-base"
              onKeyDown={e => e.key === "Enter" && doLogin(email, password)}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>비밀번호</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input-base"
              onKeyDown={e => e.key === "Enter" && doLogin(email, password)}
            />
          </div>

          {error && (
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", marginBottom: 12, fontSize: 12, color: "#e53e3e", fontWeight: 600 }}>
              ⚠️ {error}
            </div>
          )}

          <button
            onClick={() => doLogin(email, password)}
            disabled={loading || !email || !password}
            className="btn-primary"
            style={{ width: "100%", padding: "13px", fontSize: 15, borderRadius: 9 }}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 16 }}>
          아직 계정이 없으신가요?{" "}
          <a href="/signup" style={{ color: "#1251aa", fontWeight: 600, textDecoration: "none" }}>회원가입</a>
          으로 시작하세요
        </p>
      </div>
    </div>
  );
}
