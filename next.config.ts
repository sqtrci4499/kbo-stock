import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options",            value: "nosniff" },
          { key: "X-Frame-Options",                   value: "DENY" },
          { key: "X-XSS-Protection",                  value: "1; mode=block" },
          { key: "Referrer-Policy",                   value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",                value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        // SSE 경로는 캐시 없음
        source: "/api/sse",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },

  // 불필요한 로그 줄이기
  logging: { fetches: { fullUrl: false } },

  // 서버 외부 패키지
  serverExternalPackages: ["pg"],
};

export default nextConfig;
