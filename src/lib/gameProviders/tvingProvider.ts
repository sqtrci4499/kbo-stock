/**
 * TVING KBO Provider (v8, 1순위)
 *
 * TVING은 2024~2031 시즌 KBO 뉴미디어(온라인) 중계권을 독점 보유하고 있어
 * 네이버보다 데이터 신뢰도가 높을 것으로 기대되는 소스입니다.
 *
 * [알려진 이슈] TVING의 일정/순위 페이지(https://www.tving.com/sports/kbo/schedule 등)는
 * 완전히 클라이언트 렌더링되는 SPA라, 이 프로젝트를 만드는 샌드박스 환경에서는
 * 실제 내부 API 요청을 캡처할 방법이 없었습니다. 정적 HTML 요청으로는 빈 셸(shell)만
 * 응답하고, 시도해본 일부 TVING 서브도메인(mkt.tving.com)은 봇 차단(WAF)에 걸렸습니다.
 *
 * 그래서 이 Provider는:
 *   - URL을 추측해서 하드코딩하지 않습니다 (TVING_API.GAMES_URL이 비어 있으면 즉시
 *     "설정 필요" 에러를 명확히 로그하고 빈 배열을 반환합니다)
 *   - .env의 TVING_GAMES_URL / TVING_STANDINGS_URL 등에 실제 캡처한 값을 넣으면
 *     코드 수정 없이 바로 동작합니다
 *   - 응답 JSON의 필드 이름(gameId, homeTeamName 등)도 추측입니다. 실제 응답 구조가
 *     다르면 games.length === 0 이 되거나 파싱이 실패할 수 있으니, 실제 응답 샘플을
 *     확인한 뒤 아래 parseGame() 매핑을 조정해야 합니다.
 *
 * v6~v8 정책: 실패 시 mock으로 "자동 전환"하는 책임은 이 클래스에 없습니다.
 *           실패 원인을 console.error로 명확히 남기고 빈 배열만 반환합니다.
 */

import type { GameProvider, RawGame, GameStatus } from "./types";
import { KBO_TEAM_MAP, TVING_API } from "@/config";

interface TvingGameRaw {
  gameId?: string;
  matchId?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamCode?: string;
  awayTeamCode?: string;
  homeScore?: number;
  awayScore?: number;
  statusCode?: string;    // 추측: BEFORE | LIVE | END | CANCEL | POSTPONE
  statusText?: string;
  stadium?: string;
  stadiumName?: string;
  startTime?: string;
  gameDateTime?: string;
  inning?: number;
  currentInning?: number;
}

function mapStatus(code?: string): GameStatus {
  const c = (code ?? "").toUpperCase();
  if (c.includes("LIVE") || c.includes("ING")) return "LIVE";
  if (c.includes("END") || c.includes("RESULT") || c.includes("FINAL")) return "FINAL";
  if (c.includes("CANCEL") || c.includes("POSTPONE") || c.includes("RAIN")) return "CANCELLED";
  return "SCHEDULED";
}

function mapTeamName(nameOrCode?: string): string | null {
  if (!nameOrCode) return null;
  if (KBO_TEAM_MAP[nameOrCode]) return KBO_TEAM_MAP[nameOrCode];
  const found = Object.entries(KBO_TEAM_MAP).find(
    ([, v]) => v === nameOrCode || nameOrCode.includes(v)
  );
  return found ? found[1] : null;
}

export class TvingProvider implements GameProvider {
  readonly name = "tving";

  async fetchTodayGames(): Promise<RawGame[]> {
    if (!TVING_API.GAMES_URL) {
      console.error(
        "[TvingProvider] ❌ TVING_GAMES_URL이 설정되지 않았습니다. " +
        "실제 브라우저에서 캡처한 API URL을 .env의 TVING_GAMES_URL에 넣어주세요. " +
        "(캡처 방법: MIGRATION_NOTES.md 참고)"
      );
      return [];
    }

    const today = new Date().toISOString().slice(0, 10);
    const dateParam = today.replace(/-/g, "");
    const url = TVING_API.GAMES_URL.replace(/{date}/g, dateParam);

    let res: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6_000);

      res = await fetch(url, {
        signal: controller.signal,
        headers: TVING_API.HEADERS,
        cache: "no-store",
      }).finally(() => clearTimeout(timeout));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[TvingProvider] ❌ 네트워크 요청 실패: ${msg} (url=${url})`);
      return [];
    }

    if (!res.ok) {
      const bodySnippet = await res.text().then(t => t.slice(0, 300)).catch(() => "(본문 읽기 실패)");
      console.error(
        `[TvingProvider] ❌ HTTP ${res.status} ${res.statusText} — url=${url}\n` +
        `  → TVING은 봇 차단(WAF)이 있을 수 있습니다. 헤더(Referer/Origin/UA/쿠키)를 실제 브라우저와 동일하게 맞춰보세요.\n` +
        `  → 응답 본문(최대 300자): ${bodySnippet}`
      );
      return [];
    }

    let json: any;
    try {
      json = await res.json();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[TvingProvider] ❌ JSON 파싱 실패: ${msg} — 응답이 JSON이 아닐 수 있습니다 (HTML 로그인 페이지 등).`);
      return [];
    }

    // 응답 구조 추측 — 실제 응답을 확인한 뒤 조정 필요
    const list: TvingGameRaw[] =
      json?.result?.games ?? json?.data?.games ?? json?.games ?? json?.data?.list ?? json?.list ?? [];

    if (!Array.isArray(list)) {
      console.error("[TvingProvider] ❌ 응답 형식이 예상과 다릅니다 (games 배열을 찾을 수 없음). parseGame()의 필드 매핑을 실제 응답에 맞게 조정해주세요.");
      return [];
    }
    if (list.length === 0) {
      console.warn("[TvingProvider] ⚠️ 오늘 등록된 KBO 경기가 0건입니다 (API 응답은 정상일 수 있음).");
      return [];
    }

    const now = new Date().toISOString();
    const games: RawGame[] = [];
    let skipped = 0;

    for (const g of list) {
      const home = mapTeamName(g.homeTeamCode ?? g.homeTeamName);
      const away = mapTeamName(g.awayTeamCode ?? g.awayTeamName);
      if (!home || !away) { skipped += 1; continue; }

      const status  = mapStatus(g.statusCode);
      const homeWin = status === "FINAL" && (g.homeScore ?? 0) > (g.awayScore ?? 0);
      const awayWin = status === "FINAL" && (g.awayScore ?? 0) > (g.homeScore ?? 0);
      const rawTime = g.gameDateTime ?? g.startTime;
      const gameTime = rawTime
        ? new Date(rawTime).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "--:--";
      const inning = g.inning ?? g.currentInning ?? 0;

      games.push({
        externalId: `tving-${g.gameId ?? g.matchId}`,
        rawSource:  this.name,
        gameDate:   today,
        gameTime,
        stadium:    g.stadium ?? g.stadiumName ?? "구장 미정",
        homeTeam:   home,
        awayTeam:   away,
        homeScore:  g.homeScore ?? null,
        awayScore:  g.awayScore ?? null,
        inning,
        status,
        currentStatusText: g.statusText ?? (status === "FINAL" ? "경기종료" : status === "LIVE" ? `${inning}회 진행중` : `${gameTime} 경기예정`),
        winnerTeam: homeWin ? home : awayWin ? away : null,
        loserTeam:  homeWin ? away : awayWin ? home : null,
        lastSyncedAt: now,
      });
    }

    if (skipped > 0) {
      console.warn(`[TvingProvider] ⚠️ 팀명 매핑 실패로 ${skipped}건 건너뜀 (KBO_TEAM_MAP 확인 필요)`);
    }
    console.info(`[TvingProvider] ✅ ${games.length}건 수집 완료`);

    return games;
  }
}
