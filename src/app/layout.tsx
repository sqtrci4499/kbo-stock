import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title:       { default: "KBO STOCK", template: "%s | KBO STOCK" },
  description: "KBO 10개 구단을 가상 주식처럼 매수·매도하는 스포츠 투자 시뮬레이션",
  keywords:    ["KBO", "야구", "가상투자", "주식", "KBO STOCK"],
  openGraph: {
    title:       "KBO STOCK",
    description: "KBO 팀에 투자하라. 야구와 투자를 하나로.",
    type:        "website",
    locale:      "ko_KR",
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <Sidebar />
            <div className="app-main">
              <TopBar />
              <main className="app-content pb-mobile">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
