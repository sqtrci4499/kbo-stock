/**
 * 스탯티즈(Statiz) KBO 경기 Provider
 * 네이버 스포츠 Provider 실패 시 2순위 폴백으로 사용됩니다.
 *
 * 스탯티즈는 HTML 페이지 기반이므로 정규식/문자열 파싱을 사용합니다.
 * 페이지 구조 변경에 취약하므로 파싱 실패 시에도 절대 throw하지 않습니다.
 */

import type { GameProvider, RawGame, GameStatus } from "./types";
import { KBO_TEAM_MAP } from "@/config";

const STATIZ_TODAY_URL = "https://statiz.sporki.com/schedule/";

function mapTeamName(text: string): string | null {
  for (const [alias, short] of Object.entries(KBO_TEAM_MAP)) {
    if (text.includes(alias)) return short;
  }
  return null;
}

function guessStatus(text: string): GameStatus {
  if (text.includes("경기종료") || text.includes("종료")) return "final";
  if (text.includes("경기중") || text.includes("LIVE"))   return "live";
  if (text.includes("취소"))                               return "cancelled";
  if (text.includes("우천") || text.includes("연기"))      return "postponed";
  return "scheduled";
}

export class StatizProvider implements GameProvider {
  readonly name = "statiz";

  async fetchTodayGames(): Promise<RawGame[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);

      const res = await fetch(STATIZ_TODAY_URL, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; KBOStockBot/1.0)" },
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));

      if (!res.ok) {
        console.warn(`[StatizProvider] HTTP ${res.status} — 빈 배열 반환`);
        return [];
      }

      const html = await res.text();
      const todayStr = new Date().toISOString().slice(0, 10);

      // 매우 단순화된 패턴 매칭 — 실제 페이지 구조에 맞춰 조정 필요
      // 예: "LG 3 : 2 두산" 같은 텍스트 블록을 정규식으로 추출
      const gameBlockRegex =
        /([가-힣]{2,3})\s*(\d+)?\s*[:vs]\s*(\d+)?\s*([가-힣]{2,3})/g;

      const games: RawGame[] = [];
      let match: RegExpExecArray | null;
      let idx = 0;

      while ((match = gameBlockRegex.exec(html)) !== null) {
        const [, homeRaw, homeScoreRaw, awayScoreRaw, awayRaw] = match;
        const home = mapTeamName(homeRaw);
        const away = mapTeamName(awayRaw);
        if (!home || !away || home === away) continue;

        idx += 1;
        games.push({
          externalId: `statiz-${todayStr}-${idx}`,
          source: this.name,
          homeTeamShortName: home,
          awayTeamShortName: away,
          homeScore: homeScoreRaw ? parseInt(homeScoreRaw, 10) : null,
          awayScore: awayScoreRaw ? parseInt(awayScoreRaw, 10) : null,
          status: guessStatus(html.slice(match.index, match.index + 200)),
          inning: 0,
          inningHalf: "top",
          stadium: null,
          gameDate: todayStr,
          startTime: null,
        });
      }

      if (games.length === 0) {
        console.warn("[StatizProvider] 파싱된 경기 없음 — 페이지 구조가 변경되었을 수 있음");
      }

      return games;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[StatizProvider] 수집 실패 (${msg}) — 빈 배열 반환`);
      return [];
    }
  }
}
