"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const { login } = useAuth();
  const router    = useRouter();
  const [form, setForm] = useState({ email: "", password: "", passwordConfirm: "", nickname: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setError("");
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다."); return;
    }
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, nickname: form.nickname }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // 자동 로그인 후 홈으로
      await login(form.email, form.password);
      router.push("/");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "회원가입 실패");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px 80px" }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* 로고 */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "linear-gradient(135deg,#1251aa,#0f3f87)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 12px" }}>⚾</div>
          <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>KBO STOCK 회원가입</h1>
          <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>가입 즉시 1,000만원 가상 자산 지급!</p>
        </div>

        <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: 14, padding: "24px 20px" }}>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { k: "nickname" as const, label: "닉네임", type: "text",     placeholder: "야구왕 (2~20자)" },
              { k: "email"    as const, label: "이메일", type: "email",    placeholder: "email@example.com" },
              { k: "password" as const, label: "비밀번호", type: "password", placeholder: "4자 이상" },
              { k: "passwordConfirm" as const, label: "비밀번호 확인", type: "password", placeholder: "비밀번호 재입력" },
            ].map(({ k, label, type, placeholder }) => (
              <div key={k}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#475569", display: "block", marginBottom: 5 }}>{label}</label>
                <input type={type} value={form[k]} onChange={set(k)} placeholder={placeholder} required
                  className="input-base" />
              </div>
            ))}

            {error && (
              <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", fontSize: 12, color: "#e53e3e", fontWeight: 600 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ padding: "13px", fontSize: 15, borderRadius: 9, marginTop: 4 }}>
              {loading ? "가입 중..." : "회원가입 & 시작하기 🚀"}
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
          이미 계정이 있으신가요?{" "}
          <Link href="/login" style={{ color: "#1251aa", fontWeight: 600, textDecoration: "none" }}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
