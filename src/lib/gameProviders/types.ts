/**
 * KBO STOCK v6 - 경기 데이터 Provider 인터페이스 (확장판)
 *
 * 우선순위: naver(네이버 스포츠) → kbo(KBO 공식) → mock
 * .env 의 GAME_PROVIDER 로 강제 지정 가능 (예: GAME_PROVIDER=naver)
 *
 * v5의 src/lib/providers/ 와 별개로 동작하는 신규 구조입니다.
 * 기존 providers/ 디렉토리는 삭제하지 않고 유지하되, gameSync.ts는
 * 이제 이 gameProviders/ 를 사용합니다.
 */

export type GameStatus = "SCHEDULED" | "LIVE" | "FINAL" | "CANCELLED";

export interface RawGame {
  /** Provider가 부여하는 고유 식별자 (중복 동기화 방지) */
  externalId: string;
  /** 데이터 출처 ("naver" | "kbo" | "mock") */
  rawSource: string;

  gameDate: string;   // YYYY-MM-DD
  gameTime: string;   // HH:mm (경기 시작 예정/실제 시각)
  stadium:  string;

  homeTeam: string;   // short_name (KBO_TEAM_MAP 매핑된 값)
  awayTeam: string;

  homeScore: number | null;
  awayScore: number | null;

  inning: number;     // 0 = 경기 전
  status: GameStatus;

  /** 사람이 읽는 상태 텍스트 (예: "6회초", "경기종료", "18:30 경기예정") */
  currentStatusText: string;

  /** FINAL 상태일 때만 채워짐 */
  winnerTeam: string | null;
  loserTeam:  string | null;

  /** 이 데이터가 수집된 시각 (ISO) */
  lastSyncedAt: string;
}

export interface GameProvider {
  readonly name: string;

  /**
   * 오늘 KBO 경기 전체를 가져옵니다.
   *
   * v6 정책: 수집 실패 시 빈 배열을 반환하되,
   * 반드시 console.error 로 명확한 원인을 출력해야 합니다.
   * (mock으로 "자동 전환"하는 책임은 이 함수가 아니라
   *  ProviderChain.fetchTodayGames() 가 가집니다.)
   */
  fetchTodayGames(): Promise<RawGame[]>;
}
