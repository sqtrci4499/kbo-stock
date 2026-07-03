/**
 * KBO 공식 홈페이지 Provider (v9, 1순위 — 실제 검증됨)
 *
 * koreabaseball.com의 내부 웹서비스 `/ws/Schedule.asmx/GetScheduleList`를 사용합니다.
 * 이 URL/파라미터/응답 구조는 추측이 아니라, 사용자가 직접 curl로 캡처해서 확인한
 * 실제 응답입니다 (2026-07-02 기준):
 *
 *   POST https://www.koreabaseball.com/ws/Schedule.asmx/GetScheduleList
 *   Content-Type: application/x-www-form-urlencoded; charset=UTF-8
 *   Referer: https://www.koreabaseball.com/Schedule/Schedule.aspx
 *   Cookie: ASP.NET_SessionId=... (먼저 Schedule.aspx를 GET해서 얻어야 함 — 없으면
 *           "입력 문자열의 형식이 잘못되었습니다" 에러가 남)
 *   Body: leId=1&srIdList=0,9,6&seasonId=2026&gameMonth=07&teamId=
 *
 *   응답은 Content-Type: text/plain; charset=UTF-8 (진짜 UTF-8, EUC-KR 아님)이고,
 *   본문은 그리드 렌더링용 JSON입니다:
 *   {
 *     rows: [
 *       { row: [ {Text, Class, RowSpan, ...}, ... ] },   // 한 경기 = 한 row
 *       ...
 *     ]
 *   }
 *
 *   각 row.row 배열의 셀 구성 (Class로 식별):
 *     - "day"   : "07.01(수)" — 그날의 첫 경기에만 존재 (RowSpan으로 그날 경기 수만큼 묶임).
 *                 이후 같은 날 경기들은 이 셀이 없으므로 마지막으로 본 day를 이어서 사용해야 함.
 *     - "time"  : "<b>18:30</b>"
 *     - "play"  : "<span>원정팀</span><em><span class=win|lose|same>점수</span><span>vs</span>
 *                 <span class=win|lose|same>점수</span></em><span>홈팀</span>"
 *                 → 팀 이름 표시 순서는 "원정 vs 홈" (gameId의 팀 코드 순서와 동일하게 확인됨:
 *                    예) gameId=20260701SKHT0 은 SK(SSG,원정)+HT(KIA,홈), 경기장은 KIA 홈구장인 광주)
 *     - "relay" : 리뷰/하이라이트 링크 HTML. href에 실제 gameId가 그대로 들어있음
 *                 (예: /Schedule/GameCenter/Main.aspx?gameDate=20260701&gameId=20260701LTOB0&section=REVIEW)
 *                 → gameId는 이 링크에서 추출하며, 직접 조합하지 않음 (조합 시도는 실패했었음)
 *     - (class 없음, relay 다음 5개 셀 순서) : [하이라이트링크, 중계채널코드, (빈칸/미상), 구장, (빈칸 or "-")]
 *
 *   [알려진 한계] 아직 "경기 진행중(LIVE)" 상태인 row 샘플을 직접 확인하지 못했습니다.
 *   그래서 LIVE 판별은 다음 추론에 의존합니다 (섹션=REVIEW 링크 유무로 종료 여부 판단):
 *     - 점수가 없으면 SCHEDULED
 *     - 점수가 있고 relay 링크의 section이 REVIEW면 FINAL
 *     - 점수가 있고 REVIEW가 아니면(또는 링크가 다른 형태면) LIVE로 간주
 *   실제 진행중 경기 데이터를 확인하면 이 부분을 더 정확히 다듬어야 합니다.
 *
 * v6~v9 정책: 실패 시 mock으로 "자동 전환"하는 책임은 이 클래스에 없습니다.
 *           실패 원인을 console.error로 명확히 남기고 빈 배열만 반환합니다.
 */

import type { GameProvider, RawGame, GameStatus } from "./types";
import { KBO_TEAM_MAP } from "@/config";
import { curlGet, curlPost } from "./curlFetch";

const BASE_URL      = "https://www.koreabaseball.com";
const SCHEDULE_PAGE = `${BASE_URL}/Schedule/Schedule.aspx`;
const SCHEDULE_API  = `${BASE_URL}/ws/Schedule.asmx/GetScheduleList`;
// 사용자가 실제로 curl로 성공시킨 요청과 동일한 값 (검증됨).
// 완전한 최신 브라우저 UA 문자열(Chrome/125...)로 바꿨을 때는 Set-Cookie가
// 오지 않는 현상이 재현되어, 특정 브라우저를 사칭하지 않는 이 단순한 값을 그대로 유지한다.
const UA = "Mozilla/5.0";

interface GridCell {
  Text: string;
  Class: string | null;
  RowSpan?: string | null;
}
interface GridRow {
  row: GridCell[];
}
interface GridResponse {
  rows: GridRow[];
}

function mapTeamName(text: string): string | null {
  const trimmed = text.trim();
  if (KBO_TEAM_MAP[trimmed]) return KBO_TEAM_MAP[trimmed];
  const found = Object.entries(KBO_TEAM_MAP).find(([, v]) => v === trimmed);
  return found ? found[1] : null;
}

/**
 * Schedule.aspx를 GET해서 ASP.NET_SessionId 쿠키를 얻는다 (있으면 사용, 없어도 계속 진행).
 *
 * Node.js 내장 fetch로는 koreabaseball.com이 세션 쿠키 없는 축소 페이지를 반환하는
 * 현상이 확인되어(TLS 지문 추정), 시스템 curl을 그대로 호출하는 방식을 사용한다.
 * (자세한 이유는 curlFetch.ts 상단 주석 참고)
 *
 * [정책 변경] 이전에는 Set-Cookie가 없으면 곧바로 실패 처리했지만, 이는 과도한 가정이었다.
 * GetScheduleList가 실제로 세션 쿠키를 요구하는지는 POST 응답으로만 확인 가능하므로,
 * 여기서는 쿠키를 "있으면 쓰고, 없으면 없는 대로 넘긴다". 최종 성공/실패 판단은
 * fetchScheduleGrid()의 POST 응답 결과가 담당한다.
 */
async function acquireSessionCookie(): Promise<string | null> {
  const result = await curlGet(SCHEDULE_PAGE, {
    "User-Agent": UA,
  });

  if (!result) {
    console.warn("[KboProvider] ⚠️ curl GET 자체가 실패했습니다 (curl 바이너리 확인 필요). 쿠키 없이 POST를 시도합니다.");
    return null;
  }

  if (result.status !== 200) {
    console.warn(`[KboProvider] ⚠️ Schedule.aspx 응답 status=${result.status}. 쿠키 없이 POST를 시도합니다. (본문 앞부분: ${result.body.slice(0, 200)})`);
    return null;
  }

  const setCookies = result.headers["set-cookie"] ?? [];
  if (setCookies.length === 0) {
    console.warn(`[KboProvider] ⚠️ Set-Cookie 없음 (body length=${result.body.length}) → 쿠키 없이 요청 계속`);
    return null;
  }

  const sessionEntry = setCookies.find(c => /ASP\.NET_SessionId=/i.test(c));
  if (!sessionEntry) {
    console.warn(`[KboProvider] ⚠️ Set-Cookie는 있지만 ASP.NET_SessionId를 찾을 수 없습니다: ${setCookies.join(" | ")} → 쿠키 없이 요청 계속`);
    return null;
  }

  const match = sessionEntry.match(/ASP\.NET_SessionId=[^;]+/i);
  if (match) {
    console.info(`[KboProvider] ℹ️ 세션 쿠키 획득 성공 (${match[0].slice(0, 30)}...)`);
  }
  return match ? match[0] : null;
}

async function fetchScheduleGrid(seasonId: number, gameMonth: string, sessionCookie: string | null): Promise<GridResponse | null> {
  const body = new URLSearchParams({
    leId: "1",
    srIdList: "0,9,6", // 정규시즌 (시범/포스트시즌 제외)
    seasonId: String(seasonId),
    gameMonth,
    teamId: "",
  }).toString();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": UA,
    "Referer": SCHEDULE_PAGE,
  };
  // 세션 쿠키가 있을 때만 Cookie 헤더를 추가한다. (없어도 요청 자체는 시도한다 — 성공/실패는
  // 이 POST 응답으로만 최종 판단한다)
  if (sessionCookie) {
    headers["Cookie"] = sessionCookie;
    console.info("[KboProvider] ℹ️ 세션 쿠키 포함하여 GetScheduleList 요청");
  } else {
    console.warn("[KboProvider] ⚠️ 세션 쿠키 없이 GetScheduleList 요청 (성공 여부는 응답으로 확인)");
  }

  const raw = await curlPost(SCHEDULE_API, body, headers);

  if (raw === null) {
    console.error("[KboProvider] ❌ POST 실패: curl 실행 자체가 실패했습니다 (curl 바이너리 확인 필요).");
    return null;
  }

  let json: any;
  try {
    json = JSON.parse(raw);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[KboProvider] ❌ POST 실패: JSON 파싱 실패 (${msg}) — 응답 앞부분: ${raw.slice(0, 200)}`);
    return null;
  }

  if (json?.msg && !Array.isArray(json?.rows)) {
    // {code:200, msg:"..."} 형태의 서버측 검증 에러 (세션/파라미터 문제)
    console.error(`[KboProvider] ❌ POST 실패: 서버 에러 응답 — ${json.msg}`);
    return null;
  }

  console.info(`[KboProvider] ✅ POST 성공: ${Array.isArray(json?.rows) ? json.rows.length : 0}개 row 수신`);
  return json as GridResponse;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

function parsePlayCell(html: string): { away: string; home: string; awayScore: number | null; homeScore: number | null; awayResult: string | null; homeResult: string | null } | null {
  // 점수 있는 경우: <span>원정</span><em><span class="win">5</span><span>vs</span><span class="lose">2</span></em><span>홈</span>
  const withScore = html.match(
    /<span>([^<]+)<\/span><em><span class="(\w+)">(\d+)<\/span><span>vs<\/span><span class="(\w+)">(\d+)<\/span><\/em><span>([^<]+)<\/span>/
  );
  if (withScore) {
    const [, away, awayClass, awayScore, homeClass, homeScore, home] = withScore;
    return {
      away, home,
      awayScore: parseInt(awayScore, 10),
      homeScore: parseInt(homeScore, 10),
      awayResult: awayClass,
      homeResult: homeClass,
    };
  }
  // 점수 없는 경우(경기 전): <span>원정</span><em><span>vs</span></em><span>홈</span> 형태로 추정
  const noScore = html.match(/<span>([^<]+)<\/span><em>.*?<\/em><span>([^<]+)<\/span>/);
  if (noScore) {
    const [, away, home] = noScore;
    return { away, home, awayScore: null, homeScore: null, awayResult: null, homeResult: null };
  }
  return null;
}

export class KboProvider implements GameProvider {
  readonly name = "kbo";

  async fetchTodayGames(): Promise<RawGame[]> {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const seasonId = now.getFullYear();
    const gameMonth = String(now.getMonth() + 1).padStart(2, "0");

    const sessionCookie = await acquireSessionCookie();
    // sessionCookie가 null이어도 중단하지 않는다 — 세션 쿠키 없이 POST를 시도하고,
    // 최종 성공/실패는 fetchScheduleGrid()의 응답으로 판단한다.

    const grid = await fetchScheduleGrid(seasonId, gameMonth, sessionCookie);
    if (!grid || !Array.isArray(grid.rows)) {
      console.error("[KboProvider] ❌ 일정 응답이 비어있거나 형식이 예상과 다릅니다.");
      return [];
    }
    console.info(`[KboProvider] ℹ️ 이번 달 전체 ${grid.rows.length}개 row 수신 (오늘=${todayStr} 필터링 예정)`);

    // KBO 사이트가 표시하는 "MM.DD(요일)" 형식으로 오늘 날짜 문자열을 만들어 매칭에 사용
    const todayDayLabel = `${gameMonth}.${String(now.getDate()).padStart(2, "0")}(`;
    console.info(`[KboProvider] ℹ️ 오늘 날짜 라벨 매칭 기준: "${todayDayLabel}"`);

    const nowSyncedAt = now.toISOString();
    const games: RawGame[] = [];
    let currentDayLabel = "";
    let skipped = 0;

    for (const r of grid.rows) {
      const cells = r.row;
      if (!Array.isArray(cells) || cells.length === 0) continue;

      const dayCell = cells.find(c => c.Class === "day");
      if (dayCell) currentDayLabel = dayCell.Text;

      // 오늘 날짜가 아닌 row는 건너뜀 (이번 달 전체를 받아오므로 필터링 필요)
      if (!currentDayLabel.startsWith(todayDayLabel)) continue;

      const timeCell  = cells.find(c => c.Class === "time");
      const playCell  = cells.find(c => c.Class === "play");
      const relayCell = cells.find(c => c.Class === "relay");
      if (!timeCell || !playCell) { skipped += 1; continue; }

      const relayIdx = cells.indexOf(relayCell as GridCell);
      const trailingCells = relayIdx >= 0 ? cells.slice(relayIdx + 1) : [];
      const stadiumCell = trailingCells[3]; // [highlight, broadcast, ?, stadium, last]
      const lastCell    = trailingCells[4];

      const parsedPlay = parsePlayCell(playCell.Text);
      if (!parsedPlay) { skipped += 1; continue; }

      const away = mapTeamName(parsedPlay.away);
      const home = mapTeamName(parsedPlay.home);
      if (!away || !home) { skipped += 1; continue; }

      // gameId는 relay 링크 href에서 직접 추출 (조합하지 않음)
      const gameIdMatch = relayCell?.Text.match(/gameId=([A-Za-z0-9]+)/);
      const isReview = /section=REVIEW/i.test(relayCell?.Text ?? "");
      const gameId = gameIdMatch ? gameIdMatch[1] : `${todayStr.replace(/-/g, "")}-${away}-${home}`;

      const gameTime = stripHtml(timeCell.Text) || "--:--";
      const stadium  = stadiumCell ? stripHtml(stadiumCell.Text) : "구장 미정";
      const lastText = lastCell ? stripHtml(lastCell.Text) : "";

      let status: GameStatus;
      if (/취소|우천|연기/.test(lastText)) {
        status = "CANCELLED";
      } else if (parsedPlay.awayScore === null || parsedPlay.homeScore === null) {
        status = "SCHEDULED";
      } else if (isReview) {
        status = "FINAL";
      } else {
        // 점수는 있지만 리뷰(종료) 링크가 아직 없는 경우 → 진행중으로 간주 (미검증 추론)
        status = "LIVE";
      }

      const homeWin = status === "FINAL" && parsedPlay.homeResult === "win";
      const awayWin = status === "FINAL" && parsedPlay.awayResult === "win";

      const currentStatusText =
        status === "FINAL" ? "경기종료" :
        status === "LIVE"  ? "경기중" :
        status === "CANCELLED" ? (lastText || "취소") :
        `${gameTime} 경기예정`;

      games.push({
        externalId: `kbo-${gameId}`,
        rawSource:  this.name,
        gameDate:   todayStr,
        gameTime,
        stadium,
        homeTeam:   home,
        awayTeam:   away,
        homeScore:  parsedPlay.homeScore,
        awayScore:  parsedPlay.awayScore,
        inning:     0, // GetScheduleList에는 이닝 정보가 없음 (필요 시 GetScoreBoardScroll 별도 연동 필요)
        status,
        currentStatusText,
        winnerTeam: homeWin ? home : awayWin ? away : null,
        loserTeam:  homeWin ? away : awayWin ? home : null,
        lastSyncedAt: nowSyncedAt,
      });
    }

    if (skipped > 0) {
      console.warn(`[KboProvider] ⚠️ 파싱 실패/팀명 매핑 실패로 ${skipped}건 건너뜀`);
    }
    console.info(`[KboProvider] ✅ ${games.length}건 수집 완료 (${todayStr})`);

    return games;
  }
}
