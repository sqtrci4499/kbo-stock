"use client";
import { useState } from "react";

interface Props {
  emoji:    string;
  color:    string;
  size?:    number;
  name?:    string;
  /** 네이버 스포츠 등에서 가져온 팀 엠블럼 이미지 URL (선택) */
  logoUrl?: string | null;
}

/**
 * 팀 로고 표시 컴포넌트
 * - logoUrl이 있으면 실제 엠블럼 이미지를 표시
 * - 이미지가 없거나 로드 실패 시 이모지로 자동 폴백 (Graceful Degradation)
 */
export default function TeamLogo({ emoji, color, size = 40, name, logoUrl }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const useImage = !!logoUrl && !imgFailed;

  return (
    <div
      title={name}
      style={{
        width: size, height: size, borderRadius: size * 0.25,
        background: useImage ? "white" : color,
        border: useImage ? "1px solid #e2e8f0" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.46, flexShrink: 0,
        boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
        overflow: "hidden",
      }}
    >
      {useImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl ?? undefined}
          alt={name ?? "team logo"}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "contain", padding: size * 0.08 }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      ) : (
        <span>{emoji}</span>
      )}
    </div>
  );
}
