/**
 * 네이버 스포츠 KBO 일정/스코어 Provider
 *
 * 공식 API가 없으므로 네이버 스포츠의 공개 일정 API(비공식)를 사용합니다.
 * 페이지 구조나 엔드포인트는 예고 없이 바뀔 수 있으므로,
 * 실패 시 절대 throw 하지 않고 빈 배열을 반환해 상위에서 다음 Provider로
 * 자연스럽게 폴백되도록 설계되어 있습니다 (Graceful Degradation).
 *
 * ⚠️ 실서비스 적용 전 다음을 권장합니다:
 *   - 약관/로봇배제표준(robots.txt) 검토
 *   - 요청 빈도 제한 (Cron 30초~1분 권장, 과도한 폴링 금지)
 *   - 가능하면 공식 KBO/통계 제공사와 정식 계약 체결
 */

import type { GameProvider, RawGame, GameStatus, InningHalf } from "./types";
import { KBO_TEAM_MAP } from "@/config";

// 네이버 스포츠 일정 API (비공식, 변경 가능성 있음)
const NAVER_SCHEDULE_URL =
  "https://api-gw.sports.naver.com/schedule/games?fields=basic,broadcast&fromDate={date}&toDate={date}&categoryId=kbo";

interface NaverGameRaw {
  gameId: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeScore?: number;
  awayScore?: number;
  statusCode?: string;     // BEFORE | LIVE | RESULT | CANCEL ...
  stadium?: string;
  gameDateTime?: string;
  inning?: number;
  inningTopBottom?: string; // T | B
}

function mapStatus(code?: string): GameStatus {
  switch (code) {
    case "LIVE":    return "live";
    case "RESULT":  return "final";
    case "CANCEL":  return "cancelled";
    case "POSTPONE":return "postponed";
    case "BEFORE":
    default:        return "scheduled";
  }
}

function mapTeamName(nameOrCode?: string): string | null {
  if (!nameOrCode) return null;
  // KBO_TEAM_MAP의 키(별칭) 또는 값(정식 short_name) 둘 다 매칭 시도
  if (KBO_TEAM_MAP[nameOrCode]) return KBO_TEAM_MAP[nameOrCode];
  const found = Object.entries(KBO_TEAM_MAP).find(
    ([, v]) => v === nameOrCode || nameOrCode.includes(v)
  );
  return found ? found[1] : null;
}

export class NaverProvider implements GameProvider {
  readonly name = "naver";

  async fetchTodayGames(): Promise<RawGame[]> {
    try {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const url   = NAVER_SCHEDULE_URL.replace(/{date}/g, today);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000); // 6초 타임아웃

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; KBOStockBot/1.0)",
          "Accept":     "application/json",
        },
        // 외부 API이므로 Next.js 캐시 사용 안 함 (항상 최신)
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        console.warn(`[NaverProvider] HTTP ${res.status} — 빈 배열 반환 (폴백)`);
        return [];
      }

      const json = await res.json().catch(() => null);
      const list: NaverGameRaw[] =
        json?.result?.games ?? json?.games ?? json?.data ?? [];

      if (!Array.isArray(list) || list.length === 0) {
        console.warn("[NaverProvider] 파싱 가능한 경기 목록 없음 — 빈 배열 반환");
        return [];
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      const games: RawGame[] = [];
      for (const g of list) {
        const home = mapTeamName(g.homeTeamCode ?? g.homeTeamName);
        const away = mapTeamName(g.awayTeamCode ?? g.awayTeamName);
        if (!home || !away) continue; // 매핑 실패한 경기는 건너뜀 (전체 중단 X)

        games.push({
          externalId: `naver-${g.gameId}`,
          source: this.name,
          homeTeamShortName: home,
          awayTeamShortName: away,
          homeScore: g.homeScore ?? null,
          awayScore: g.awayScore ?? null,
          status: mapStatus(g.statusCode),
          inning: g.inning ?? 0,
          inningHalf: (g.inningTopBottom === "B" ? "bottom" : "top") as InningHalf,
          stadium: g.stadium ?? null,
          gameDate: todayStr,
          startTime: g.gameDateTime ?? null,
        });
      }

      return games;
    } catch (e: unknown) {
      // 네트워크 오류, 타임아웃, JSON 파싱 오류 등 — 절대 throw 하지 않음
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[NaverProvider] 수집 실패 (${msg}) — 빈 배열 반환, 다음 Provider로 폴백`);
      return [];
    }
  }
}
