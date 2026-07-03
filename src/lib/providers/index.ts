/**
 * KBO STOCK - Game Provider 매니저
 *
 * 우선순위: 네이버 스포츠 → 스탯티즈 → Mock
 * 각 단계에서 빈 배열이 반환되면 자동으로 다음 Provider를 시도합니다.
 *
 * 환경변수로 강제 Provider 지정 가능:
 *   GAME_PROVIDER=mock    → Mock만 사용 (개발/데모)
 *   GAME_PROVIDER=naver   → 네이버만 사용 (폴백 없음)
 *   GAME_PROVIDER=auto    → 기본값. 우선순위 체인 전체 시도
 */

import type { GameProvider, RawGame } from "./types";
import { NaverProvider }  from "./naverProvider";
import { StatizProvider } from "./statizProvider";
import { MockProvider }   from "./mockProvider";

const naver  = new NaverProvider();
const statiz = new StatizProvider();
const mock   = new MockProvider();

// 우선순위 체인 (앞에서부터 시도)
const PROVIDER_CHAIN: GameProvider[] = [naver, statiz, mock];

function getForcedProvider(): GameProvider | null {
  const forced = process.env.GAME_PROVIDER?.toLowerCase();
  if (!forced || forced === "auto") return null;
  switch (forced) {
    case "naver":  return naver;
    case "statiz": return statiz;
    case "mock":   return mock;
    default:
      console.warn(`[Providers] 알 수 없는 GAME_PROVIDER="${forced}" — auto 모드로 동작`);
      return null;
  }
}

/**
 * 오늘 경기 목록을 가져옵니다.
 * Graceful Degradation: 어떤 Provider도 실패해서는 안 되며,
 * 최종적으로 Mock Provider까지 실패하더라도 빈 배열을 반환할 뿐
 * 절대 예외를 던지지 않습니다.
 */
export async function fetchTodayGames(): Promise<{ games: RawGame[]; usedSource: string }> {
  const forced = getForcedProvider();

  if (forced) {
    const games = await forced.fetchTodayGames().catch(() => []);
    return { games, usedSource: forced.name };
  }

  for (const provider of PROVIDER_CHAIN) {
    try {
      const games = await provider.fetchTodayGames();
      if (games.length > 0) {
        return { games, usedSource: provider.name };
      }
      console.info(`[Providers] ${provider.name} → 0건, 다음 Provider 시도`);
    } catch (e: unknown) {
      // 이론상 각 Provider 내부에서 이미 catch하지만, 이중 안전장치
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[Providers] ${provider.name} 예외 발생 (${msg}) — 다음 Provider 시도`);
    }
  }

  console.error("[Providers] 모든 Provider 실패 — 빈 배열 반환 (시스템은 계속 동작)");
  return { games: [], usedSource: "none" };
}

export { NaverProvider, StatizProvider, MockProvider };
export type { GameProvider, RawGame } from "./types";
