/**
 * Mock Provider
 * 실제 외부 API 없이도 경기센터/정산 흐름을 시연·테스트할 수 있도록
 * 가상의 오늘 경기 데이터를 생성합니다.
 *
 * 매 호출마다 약간씩 스코어/이닝이 진행되는 것처럼 시뮬레이션합니다.
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

// 프로세스 메모리 내에서 가상 경기 상태를 유지 (서버 재시작 시 초기화됨)
interface MockGameState {
  homeScore: number; awayScore: number;
  inning: number; inningHalf: "top" | "bottom";
  status: GameStatus;
  startedAt: number; // epoch ms
}

const stateStore = new Map<string, MockGameState>();

function getOrInitState(key: string): MockGameState {
  let s = stateStore.get(key);
  if (!s) {
    s = {
      homeScore: 0, awayScore: 0,
      inning: 0, inningHalf: "top",
      status: "scheduled",
      startedAt: Date.now() + Math.floor(Math.random() * 3) * 60_000, // 0~3분 뒤 시작 시뮬레이션
    };
    stateStore.set(key, s);
  }
  return s;
}

function progressState(s: MockGameState): MockGameState {
  const elapsedMs = Date.now() - s.startedAt;

  if (elapsedMs < 0) {
    s.status = "scheduled";
    return s;
  }

  if (s.status === "final" || s.status === "cancelled") return s;

  // 약 25분에 걸쳐 9이닝 진행되는 것으로 시뮬레이션 (데모용 가속)
  const totalDurationMs = 25 * 60_000;
  const progress = Math.min(1, elapsedMs / totalDurationMs);

  s.status = "live";
  s.inning = Math.max(1, Math.min(9, Math.ceil(progress * 9)));
  s.inningHalf = Math.floor(progress * 18) % 2 === 0 ? "top" : "bottom";

  // 득점은 이닝이 올라갈 때 확률적으로 증가
  const expectedRuns = progress * 5; // 평균 5점 정도
  if (Math.random() < 0.15) {
    if (Math.random() < 0.5) s.homeScore += 1;
    else s.awayScore += 1;
  }

  if (progress >= 1) {
    s.status = "final";
    s.inning = 9;
    s.inningHalf = "bottom";
  }

  return s;
}

export class MockProvider implements GameProvider {
  readonly name = "mock";

  async fetchTodayGames(): Promise<RawGame[]> {
    // 의도적으로 약간의 네트워크 지연 시뮬레이션
    await new Promise(r => setTimeout(r, 80));

    const today = new Date().toISOString().slice(0, 10);

    return TEAM_PAIRS.map(([home, away], idx) => {
      const key = `${today}-${home}-${away}`;
      const state = progressState(getOrInitState(key));

      return {
        externalId: `mock-${key}`,
        source: this.name,
        homeTeamShortName: home,
        awayTeamShortName: away,
        homeScore: state.status === "scheduled" ? null : state.homeScore,
        awayScore: state.status === "scheduled" ? null : state.awayScore,
        status: state.status,
        inning: state.inning,
        inningHalf: state.inningHalf,
        stadium: STADIUMS[home] ?? null,
        gameDate: today,
        startTime: new Date(state.startedAt).toISOString(),
      } satisfies RawGame;
    });
  }
}
