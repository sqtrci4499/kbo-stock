/**
 * 네이버 스포츠 KBO Provider (v7)
 *
 * 공식 API가 없으므로 네이버 스포츠의 비공식 API를 사용합니다.
 * URL/헤더는 src/config/index.ts의 NAVER_API에서 관리하며,
 * .env의 NAVER_GAMES_URL / NAVER_UA / NAVER_REFERER 등으로 코드 수정 없이 교체 가능합니다.
 *
 * [알려진 이슈] 현재 NAVER_API.GAMES_URL의 기본값은 실제 브라우저 캡처로
 * 검증된 값이 아닙니다 (샌드박스 환경에서 m.sports.naver.com 접근이 차단되어
 * 실제 Network 요청을 확인할 수 없었습니다). HTTP 400이 발생한다면
 * 크롬 개발자도구로 실제 요청을 캡처하여 .env의 NAVER_GAMES_URL 등을 채워주세요.
 * (캡처 방법: MIGRATION_NOTES.md 참고)
 *
 * v6/v7 정책: 실패 시 mock으로 "자동 전환"하는 책임은 이 클래스에 없습니다.
 *           이 클래스는 실패 원인을 console.error로 명확히 남기고
 *           빈 배열만 반환합니다. mock 전환 여부는 ProviderChain이 결정합니다.
 */

import type { GameProvider, RawGame, GameStatus } from "./types";
import { KBO_TEAM_MAP, NAVER_API } from "@/config";

interface NaverGameRaw {
  gameId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeScore?: number;
  awayScore?: number;
  statusCode?: string;       // BEFORE | LIVE | RESULT | CANCEL | POSTPONE
  statusInfo?: string;       // "6회초" 같은 사람이 읽는 텍스트
  stadium?: string;
  gameDateTime?: string;     // ISO
  inning?: number;
  winner?: string;           // HOME | AWAY | (없음)
}

function mapStatus(code?: string): GameStatus {
  switch (code) {
    case "LIVE":     return "LIVE";
    case "RESULT":   return "FINAL";
    case "CANCEL":
    case "POSTPONE": return "CANCELLED";
    case "BEFORE":
    default:         return "SCHEDULED";
  }
}

function mapTeamName(nameOrCode?: string): string | null {
  if (!nameOrCode) return null;
  if (KBO_TEAM_MAP[nameOrCode]) return KBO_TEAM_MAP[nameOrCode];
  const found = Object.entries(KBO_TEAM_MAP).find(
    ([, v]) => v === nameOrCode || nameOrCode.includes(v)
  );
  return found ? found[1] : null;
}

export class NaverProvider implements GameProvider {
  readonly name = "naver";

  async fetchTodayGames(): Promise<RawGame[]> {
    const today = new Date().toISOString().slice(0, 10);
    const dateParam = today.replace(/-/g, "");
    const url = NAVER_API.GAMES_URL.replace(/{date}/g, dateParam);

    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);

      res = await fetch(url, {
        signal: controller.signal,
        headers: NAVER_API.HEADERS,
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[NaverProvider] ❌ 네트워크 요청 실패: ${msg} (url=${url})`);
      return [];
    }

    if (!res.ok) {
      // 실패 원인 진단을 위해 응답 본문 일부를 함께 남긴다 (v6 요구사항: 조용히 mock으로 넘어가지 않고 원인 로그).
      const bodySnippet = await res.text().then(t => t.slice(0, 300)).catch(() => "(본문 읽기 실패)");
      console.error(
        `[NaverProvider] ❌ HTTP ${res.status} ${res.statusText} — url=${url}\n` +
        `  → 요청 헤더가 실제 브라우저와 다르거나(Referer/Origin/UA), URL 자체가 더 이상 유효하지 않을 수 있습니다.\n` +
        `  → 응답 본문(최대 300자): ${bodySnippet}`
      );
      return [];
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[NaverProvider] ❌ JSON 파싱 실패: ${msg}`);
      return [];
    }

    const list: NaverGameRaw[] = json?.result?.games ?? json?.games ?? json?.data ?? [];

    if (!Array.isArray(list)) {
      console.error("[NaverProvider] ❌ 응답 형식이 예상과 다릅니다 (games 배열을 찾을 수 없음). 네이버 API 구조가 변경되었을 수 있습니다.");
      return [];
    }
    if (list.length === 0) {
      console.warn("[NaverProvider] ⚠️ 오늘 등록된 KBO 경기가 0건입니다 (API 응답은 정상).");
      return [];
    }

    const now = new Date().toISOString();
    const games: RawGame[] = [];
    let skipped = 0;

    for (const g of list) {
      const home = mapTeamName(g.homeTeamCode ?? g.homeTeamName);
      const away = mapTeamName(g.awayTeamCode ?? g.awayTeamName);
      if (!home || !away) { skipped += 1; continue; }

      const status   = mapStatus(g.statusCode);
      const homeWin  = status === "FINAL" && (g.homeScore ?? 0) > (g.awayScore ?? 0);
      const awayWin  = status === "FINAL" && (g.awayScore ?? 0) > (g.homeScore ?? 0);
      const gameTime = g.gameDateTime
        ? new Date(g.gameDateTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "--:--";

      games.push({
        externalId: `naver-${g.gameId}`,
        rawSource:  this.name,
        gameDate:   today,
        gameTime,
        stadium:    g.stadium ?? "구장 미정",
        homeTeam:   home,
        awayTeam:   away,
        homeScore:  g.homeScore ?? null,
        awayScore:  g.awayScore ?? null,
        inning:     g.inning ?? 0,
        status,
        currentStatusText: g.statusInfo ?? (status === "FINAL" ? "경기종료" : status === "LIVE" ? `${g.inning ?? 0}회 진행중` : `${gameTime} 경기예정`),
        winnerTeam: homeWin ? home : awayWin ? away : null,
        loserTeam:  homeWin ? away : awayWin ? home : null,
        lastSyncedAt: now,
      });
    }

    if (skipped > 0) {
      console.warn(`[NaverProvider] ⚠️ 팀명 매핑 실패로 ${skipped}건 건너뜀 (KBO_TEAM_MAP 확인 필요)`);
    }
    console.info(`[NaverProvider] ✅ ${games.length}건 수집 완료`);

    return games;
  }
}
