/**
 * KBO STOCK v10 - 팀 순위 동기화
 *
 * KBO 공식 사이트(koreabaseball.com)의 "일자별 순위" 페이지를 사용합니다.
 * (https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx)
 *
 * [실제로 검증됨] 사용자가 직접 curl로 캡처해서 확인한 사실:
 *   - 세션 쿠키 없이 일반 GET 한 번으로 순위표 전체가 HTML에 그대로 렌더링되어 옴
 *     (일정 페이지처럼 AJAX/세션이 필요하지 않음 — 더 간단한 케이스)
 *   - 응답은 진짜 UTF-8 (curl로 저장한 파일을 PowerShell 기본 인코딩으로 열면 깨지지만,
 *     이건 PowerShell 표시 문제일 뿐 실제 응답 인코딩과는 무관함 — Node.js에서
 *     curl stdout을 읽을 때는 기본이 UTF-8이라 이 문제가 발생하지 않음)
 *   - 테이블 구조(class="tData")는 표준적인 <table><thead><tbody><tr><td> 구조이며
 *     컬럼 순서: 순위, 팀명, 경기, 승, 패, 무, 승률, 게임차, 최근10경기, 연속, 홈, 방문
 *
 * [설계 결정] "최근5경기"(W/L 시퀀스)는 이 페이지에서 주는 "최근10경기"(예: 6승0무4패,
 * 승/패 개수 요약)로는 만들 수 없습니다. 대신 우리 DB의 game_results 테이블
 * (kboProvider가 이미 채워둔 실제 개별 경기 결과)에서 각 팀의 최근 5개 FINAL 경기를
 * 직접 조회해서 "WWLWL" 형식으로 계산합니다. 외부 요약보다 오히려 더 정확합니다.
 *
 * 실패 시 DB는 변경하지 않고(기존 team_stats 유지) 실패 로그만 남깁니다.
 */

import { query } from "./db";
import { KBO_TEAM_MAP } from "@/config";
import { curlGet } from "./gameProviders/curlFetch";

const RANK_PAGE = "https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx";
const UA = "Mozilla/5.0"; // koreabaseball.com에서 실제로 검증된 값 (kboProvider.ts와 동일 정책)

interface RankRow {
  rank: number;
  teamName: string;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  gamesBehind: number;
  streakText: string; // "2승" | "1패" 등
}

export interface StandingsSyncResult {
  success:    boolean;
  provider:   string;
  teamCount:  number;
  message?:   string;
  detail?:    string;
  syncedAt:   string;
}

function mapTeamName(nameOrCode?: string): string | null {
  if (!nameOrCode) return null;
  const trimmed = nameOrCode.trim();
  if (KBO_TEAM_MAP[trimmed]) return KBO_TEAM_MAP[trimmed];
  const found = Object.entries(KBO_TEAM_MAP).find(
    ([, v]) => v === trimmed || trimmed.includes(v)
  );
  return found ? found[1] : null;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** 연속 텍스트("2승"/"1패")를 streak 정수로 변환한다 (양수=연승, 음수=연패). */
function parseStreak(text: string): number {
  const m = text.match(/(\d+)\s*(승|패)/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  return m[2] === "승" ? n : -n;
}

/** TeamRankDaily.aspx의 <table class="tData"> 안 <tbody> 행들을 파싱한다. */
function parseRankTable(html: string): RankRow[] {
  const tableMatch = html.match(/<table[^>]*class="tData"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const tableHtml = tableMatch[1];

  const tbodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const bodyHtml = tbodyMatch ? tbodyMatch[1] : tableHtml;

  const rowMatches = [...bodyHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  const rows: RankRow[] = [];

  for (const rowMatch of rowMatches) {
    const cellMatches = [...rowMatch[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 10) continue;

    const cells = cellMatches.map(c => stripTags(c[1]));
    const [rankStr, teamName, gamesStr, winsStr, lossStr, drawStr, winRateStr, gbStr, , streakText] = cells;

    const rank = parseInt(rankStr, 10);
    if (!teamName || Number.isNaN(rank)) continue;

    rows.push({
      rank,
      teamName,
      games: parseInt(gamesStr, 10) || 0,
      wins: parseInt(winsStr, 10) || 0,
      losses: parseInt(lossStr, 10) || 0,
      draws: parseInt(drawStr, 10) || 0,
      winRate: parseFloat(winRateStr) || 0,
      gamesBehind: parseFloat(gbStr) || 0,
      streakText: streakText ?? "",
    });
  }

  return rows;
}

async function fetchKboRankTable(): Promise<RankRow[] | null> {
  const result = await curlGet(RANK_PAGE, { "User-Agent": UA });

  if (!result) {
    console.error("[standingsSync] ❌ curl 요청 자체가 실패했습니다 (curl 바이너리 확인 필요).");
    return null;
  }
  if (result.status !== 200) {
    console.error(`[standingsSync] ❌ HTTP ${result.status} — 응답 앞부분: ${result.body.slice(0, 200)}`);
    return null;
  }

  const rows = parseRankTable(result.body);
  if (rows.length === 0) {
    console.error("[standingsSync] ❌ 순위 테이블 파싱 결과가 비어있습니다. (페이지 구조가 바뀌었을 수 있음)");
    return null;
  }
  if (rows.length !== 10) {
    console.warn(`[standingsSync] ⚠️ 예상은 10개 팀인데 ${rows.length}개 행이 파싱되었습니다. 결과를 확인해주세요.`);
  }

  console.info(`[standingsSync] ✅ 순위표 파싱 성공: ${rows.length}개 팀`);
  return rows;
}

/** 팀별 최근 5개 FINAL 경기를 game_results에서 직접 조회해 "WWLWL" 형식으로 계산한다. */
async function computeLast5(teamId: string): Promise<string> {
  const games = await query<{ result: string }>(`
    SELECT CASE WHEN winner_team_id = $1 THEN 'W' WHEN loser_team_id = $1 THEN 'L' ELSE 'D' END AS result
    FROM game_results
    WHERE (home_team_id = $1 OR away_team_id = $1) AND status = 'final'
    ORDER BY game_date DESC, updated_at DESC
    LIMIT 5
  `, [teamId]);

  return games.map(g => g.result).join("");
}

/**
 * 팀 순위 동기화 메인 함수.
 * 실패 시 DB는 변경하지 않고(기존 team_stats 유지) 실패 로그만 기록합니다.
 */
export async function syncStandings(): Promise<StandingsSyncResult> {
  const rankRows = await fetchKboRankTable();
  const syncedAt = new Date().toISOString();
  const PROVIDER = "kbo";

  if (!rankRows) {
    await query(
      "INSERT INTO standings_sync_log (provider, success, team_count, message) VALUES ($1,$2,$3,$4)",
      [PROVIDER, false, 0, "KBO 공식 순위 페이지 수집 실패 — 기존 DB 데이터 유지"]
    ).catch(() => {});

    return {
      success: false, provider: PROVIDER, teamCount: 0,
      message: "순위 동기화 실패", detail: "KBO 공식 순위 페이지 응답 없음 — 기존 team_stats를 그대로 사용합니다",
      syncedAt,
    };
  }

  const teamIdRows = await query<{ id: string; short_name: string }>("SELECT id, short_name FROM teams");
  const teamIdMap  = Object.fromEntries(teamIdRows.map(r => [r.short_name, r.id]));

  let updated = 0;
  const unmatched: string[] = [];

  for (const row of rankRows) {
    const shortName = mapTeamName(row.teamName);
    const teamId = shortName ? teamIdMap[shortName] : null;
    if (!teamId) { unmatched.push(row.teamName); continue; }

    const streak = parseStreak(row.streakText);
    const last5  = await computeLast5(teamId);

    await query(`
      UPDATE team_stats SET
        rank = $1, wins = $2, losses = $3, draws = $4,
        win_rate = $5, games_behind = $6, streak = $7, last5 = $8,
        updated_at = NOW()
      WHERE team_id = $9
    `, [
      row.rank, row.wins, row.losses, row.draws,
      row.winRate, row.gamesBehind, streak, last5, teamId,
    ]);
    updated += 1;
  }

  if (unmatched.length > 0) {
    console.warn(`[standingsSync] ⚠️ 팀명 매핑 실패: ${unmatched.join(", ")} (KBO_TEAM_MAP 확인 필요)`);
  }

  await query(
    "INSERT INTO standings_sync_log (provider, success, team_count, message) VALUES ($1,$2,$3,$4)",
    [PROVIDER, true, updated, `${updated}개 팀 순위 갱신`]
  ).catch(() => {});

  return { success: true, provider: PROVIDER, teamCount: updated, syncedAt };
}
