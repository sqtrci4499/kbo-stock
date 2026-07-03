/**
 * Mock Provider (v6)
 * naver/kbo Provider가 모두 실패했을 때의 최종 폴백.
 * 가상 경기를 약 25분에 걸쳐 9이닝 진행되는 것처럼 시뮬레이션합니다.
 */

import type { GameProvider, RawGame, GameStatus } from "./types";

const TEAM_PAIRS: [string, string][] = [
  ["LG", "두산"],
  ["KIA", "삼성"],
  ["SSG", "롯데"],
  ["KT", "키움"],
  ["NC", "한화"],
];

const STADIUMS: Record<string, string> = {
  LG: "잠실", 두산: "잠실", KIA: "광주-기아 챔피언스필드", 삼성: "대구 삼성라이온즈파크",
  SSG: "인천 SSG랜더스필드", 롯데: "사직", KT: "수원 KT위즈파크", 키움: "고척 스카이돔",
  NC: "창원 NC파크", 한화: "대전 한화생명이글스파크",
};

interface MockState {
  homeScore: number; awayScore: number;
  inning: number; isTop: boolean;
  status: GameStatus;
  startedAt: number;
}

const stateStore = new Map<string, MockState>();

function getOrInit(key: string): MockState {
  let s = stateStore.get(key);
  if (!s) {
    s = {
      homeScore: 0, awayScore: 0, inning: 0, isTop: true,
      status: "SCHEDULED",
      startedAt: Date.now() + Math.floor(Math.random() * 3) * 60_000,
    };
    stateStore.set(key, s);
  }
  return s;
}

function progress(s: MockState): MockState {
  const elapsed = Date.now() - s.startedAt;
  if (elapsed < 0) { s.status = "SCHEDULED"; return s; }
  if (s.status === "FINAL") return s;

  const totalMs = 25 * 60_000;
  const p = Math.min(1, elapsed / totalMs);

  s.status = "LIVE";
  s.inning = Math.max(1, Math.min(9, Math.ceil(p * 9)));
  s.isTop  = Math.floor(p * 18) % 2 === 0;

  if (Math.random() < 0.15) {
    if (Math.random() < 0.5) s.homeScore += 1; else s.awayScore += 1;
  }

  if (p >= 1) { s.status = "FINAL"; s.inning = 9; s.isTop = false; }
  return s;
}

function buildStatusText(s: MockState, startTime: string): string {
  if (s.status === "SCHEDULED") return `${startTime} 경기예정`;
  if (s.status === "FINAL")     return "경기종료";
  return `${s.inning}회${s.isTop ? "초" : "말"}`;
}

export class MockProvider implements GameProvider {
  readonly name = "mock";

  async fetchTodayGames(): Promise<RawGame[]> {
    await new Promise(r => setTimeout(r, 60));

    const today = new Date().toISOString().slice(0, 10);
    const now   = new Date().toISOString();

    return TEAM_PAIRS.map(([home, away]) => {
      const key   = `${today}-${home}-${away}`;
      const state = progress(getOrInit(key));
      const startTime = new Date(state.startedAt)
        .toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

      const isFinal = state.status === "FINAL";
      const homeWin = isFinal && state.homeScore > state.awayScore;
      const awayWin = isFinal && state.awayScore > state.homeScore;

      return {
        externalId: `mock-${key}`,
        rawSource:  this.name,
        gameDate:   today,
        gameTime:   startTime,
        stadium:    STADIUMS[home] ?? "구장 미정",
        homeTeam:   home,
        awayTeam:   away,
        homeScore:  state.status === "SCHEDULED" ? null : state.homeScore,
        awayScore:  state.status === "SCHEDULED" ? null : state.awayScore,
        inning:     state.inning,
        status:     state.status,
        currentStatusText: buildStatusText(state, startTime),
        winnerTeam: homeWin ? home : awayWin ? away : null,
        loserTeam:  homeWin ? away : awayWin ? home : null,
        lastSyncedAt: now,
      } satisfies RawGame;
    });
  }
}
