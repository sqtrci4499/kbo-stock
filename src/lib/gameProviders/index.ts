/**
 * KBO STOCK v9 - Game Provider 매니저
 *
 * 우선순위: KBO 공식(kbo) → TVING(tving) → Mock(mock)
 * (v9부터: KBO 공식 사이트의 실제 API(/ws/Schedule.asmx/GetScheduleList)를
 *  사용자가 직접 curl로 캡처/검증해서 1순위로 승격했습니다. TVING/네이버는
 *  아직 URL이 검증되지 않아 후순위로 내렸습니다.)
 *
 * 환경변수로 강제 지정 가능:
 *   GAME_PROVIDER=kbo     → KBO 공식만 사용 (실패 시에도 폴백 안 함, 명확한 에러만 기록)
 *   GAME_PROVIDER=tving   → TVING만 사용 (URL 미검증, .env 설정 필요)
 *   GAME_PROVIDER=naver   → 네이버만 사용 (레거시, 데이터 안정성 낮음)
 *   GAME_PROVIDER=mock    → Mock만 사용 (데모/개발 기본값)
 *   GAME_PROVIDER=auto    → 우선순위 체인 전체 시도 (1차 실패 시에만 다음 단계로 폴백)
 *
 * v6 정책: "실패 시 mock으로 자동 전환하지 말 것"이 요구사항이므로,
 *   - GAME_PROVIDER가 명시적으로 지정된 경우 → 그 Provider만 사용, 실패해도 mock으로 가지 않음
 *   - GAME_PROVIDER=auto(또는 미설정)인 경우에만 → kbo→tving→mock 순서로 시도
 *     (이 경우의 mock 사용은 "전환"이 아니라 auto 모드의 설계된 동작입니다)
 */

import type { GameProvider, RawGame } from "./types";
import { TvingProvider } from "./tvingProvider";
import { NaverProvider } from "./naverProvider";
import { KboProvider }   from "./kboProvider";
import { MockProvider }  from "./mockProvider";

const tving = new TvingProvider();
const naver = new NaverProvider();
const kbo   = new KboProvider();
const mock  = new MockProvider();

const AUTO_CHAIN: GameProvider[] = [kbo, tving, mock];

export interface SyncFetchResult {
  games:      RawGame[];
  provider:   string;
  success:    boolean;
  message?:   string;
  detail?:    string;
}

function resolveProviderName(): string {
  return (process.env.GAME_PROVIDER ?? "auto").toLowerCase();
}

function getNamedProvider(name: string): GameProvider | null {
  switch (name) {
    case "tving": return tving;
    case "naver": return naver;
    case "kbo":   return kbo;
    case "mock":  return mock;
    default:      return null;
  }
}

/**
 * 오늘 경기 목록을 가져옵니다.
 * 응답 형태는 요청서 스펙(success/provider/message/detail)을 따릅니다.
 */
export async function fetchTodayGames(): Promise<SyncFetchResult> {
  const mode = resolveProviderName();

  // ── 특정 Provider 강제 지정 ──────────────────────
  if (mode !== "auto") {
    const provider = getNamedProvider(mode);
    if (!provider) {
      const msg = `알 수 없는 GAME_PROVIDER="${mode}". kbo | tving | naver | mock | auto 중 하나를 사용하세요.`;
      console.error(`[ProviderChain] ❌ ${msg}`);
      return { games: [], provider: mode, success: false, message: "잘못된 GAME_PROVIDER 설정", detail: msg };
    }

    try {
      const games = await provider.fetchTodayGames();
      if (games.length === 0) {
        const msg = `${provider.name} Provider가 0건을 반환했습니다.`;
        console.error(`[ProviderChain] ❌ ${msg} (GAME_PROVIDER=${mode} 고정 — mock으로 자동 전환하지 않음)`);
        return { games: [], provider: provider.name, success: false, message: "경기 데이터 수집 실패", detail: msg };
      }
      return { games, provider: provider.name, success: true };
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error(`[ProviderChain] ❌ ${provider.name} 예외 발생: ${detail} (GAME_PROVIDER=${mode} 고정 — mock으로 자동 전환하지 않음)`);
      return { games: [], provider: provider.name, success: false, message: "Provider 실행 중 예외 발생", detail };
    }
  }

  // ── auto 모드: 우선순위 체인 ──────────────────────
  const errors: string[] = [];
  for (const provider of AUTO_CHAIN) {
    try {
      const games = await provider.fetchTodayGames();
      if (games.length > 0) {
        return { games, provider: provider.name, success: true };
      }
      console.info(`[ProviderChain] ${provider.name} → 0건, 다음 Provider 시도`);
      errors.push(`${provider.name}: 0건 반환`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[ProviderChain] ❌ ${provider.name} 예외: ${msg} — 다음 Provider 시도`);
      errors.push(`${provider.name}: ${msg}`);
    }
  }

  // 체인 전체 실패 (mock까지 실패하는 경우는 사실상 없지만 방어적으로 처리)
  const detail = errors.join(" / ");
  console.error(`[ProviderChain] ❌ 모든 Provider 실패: ${detail}`);
  return { games: [], provider: "none", success: false, message: "모든 Provider 실패", detail };
}

export { TvingProvider, NaverProvider, KboProvider, MockProvider };
export type { GameProvider, RawGame, GameStatus } from "./types";
