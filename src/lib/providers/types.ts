/**
 * KBO STOCK - 경기 데이터 Provider 인터페이스
 *
 * 여러 데이터 소스(네이버 스포츠, 스탯티즈, 공식 API, Mock)를
 * 동일한 인터페이스로 교체 가능하게 만드는 추상화 계층입니다.
 *
 * 새 Provider 추가 방법:
 *   1. GameProvider 인터페이스를 구현한 클래스 작성
 *   2. providers/index.ts 의 getActiveProvider() 에 등록
 */

export type GameStatus = "scheduled" | "live" | "final" | "cancelled" | "postponed";
export type InningHalf = "top" | "bottom";

export interface RawGame {
  /** Provider가 부여하는 고유 ID (중복 동기화 방지용) */
  externalId: string;
  /** 데이터 출처 식별자 */
  source: string;

  homeTeamShortName: string; // 예: "LG", "두산" — KBO_TEAM_MAP으로 변환됨
  awayTeamShortName: string;

  homeScore: number | null;
  awayScore: number | null;

  status: GameStatus;
  inning: number;        // 0 = 경기 전
  inningHalf: InningHalf;

  stadium: string | null;
  gameDate: string;       // YYYY-MM-DD
  startTime: string | null; // ISO datetime
}

export interface GameProvider {
  /** Provider 이름 (로그/소스 표기용) */
  readonly name: string;

  /**
   * 오늘 KBO 경기 전체 목록을 가져옵니다.
   * 네트워크 실패 시 반드시 예외를 던지지 않고 빈 배열을 반환해야 합니다.
   * (Graceful Degradation은 호출부의 fetchTodayGames()에서 한 번 더 보장)
   */
  fetchTodayGames(): Promise<RawGame[]>;
}
