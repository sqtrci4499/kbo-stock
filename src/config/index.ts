import type { PriceRule } from "@/types";

// ── 주가 계산 규칙 (여기서만 수정하면 전체 반영) ──────────
export const PRICE_RULES: PriceRule = {
  win:              0.03,   // 승리 +3%
  loss:            -0.02,   // 패배 -2%
  draw:             0.00,   // 무승부 0%
  streakBonus:      0.01,   // 연승 1경기당 +1%
  streakPenalty:   -0.01,   // 연패 1경기당 -1%
  maxStreak:        5,      // 최대 5경기까지 반영
  blowoutWin:       0.015,  // 5점차 이상 승리 +1.5%
  blowoutLoss:     -0.015,  // 5점차 이상 패배 -1.5%
  blowoutThreshold: 5,      // 대량 득실점 기준 점수차
  homeBonus:        0.005,  // 홈경기 승리 추가 +0.5%
  supplyWeight:     0.30,   // 수급 30% 반영
  maxDailyChange:   0.15,   // 일반 시즌 ±15%
  maxDailyChangePostseason: 0.30, // 포스트시즌 ±30%
  inningImpactScale: 0.003, // 이닝별 실시간 영향 스케일
};

// ── 순위/승률 기반 가격 정렬 규칙 (v10) ────────────────
// 시즌 초 시드 데이터의 임의 가격이 실제 성적과 무관하게 남아있거나,
// 매경기 증분(%) 반영만으로는 장기간 실제 순위와 괴리될 수 있어
// "현재 승률 기준 공정가"로 주기적으로 재정렬하는 규칙.
export const STANDINGS_ALIGNMENT = {
  BASE_PRICE:   10000,  // 승률 5할(0.5) 팀의 기준가
  SENSITIVITY:  2,      // 승률 1.0 차이(0%→100%) 시 가격 최대 ±100% 변동
  MIN_PRICE:    3000,   // 최저가 방어선 (0원 근처로 수렴 방지)
};

// ── Cron 스케줄 ──────────────────────────────────
export const CRON = {
  LIVE_POLL_MS:       30_000,  // 경기 중 30초마다
  IDLE_POLL_MS:      600_000,  // 경기 없을 때 10분마다
  NIGHT_POLL_MS:    1800_000,  // 새벽 30분마다
  DAILY_SETTLE_HOUR: 0,        // 자정 일일 정산
  DAILY_SETTLE_MIN:  5,        // 00:05에 실행
};

// ── SSE ──────────────────────────────────────────
export const SSE = {
  HEARTBEAT_MS:   20_000,  // 20초 하트비트
  PRICE_UPDATE_MS: 5_000,  // 5초마다 가격 푸시 (경기 중)
  IDLE_UPDATE_MS: 30_000,  // 경기 없을 때 30초
};

// ── 가격 플래시 임계 ─────────────────────────────
export const ALERT = {
  SURGE_THRESHOLD:  0.05,  // 5% 이상 급등 알림
  DROP_THRESHOLD:  -0.05,  // 5% 이상 급락 알림
};

// ── 초기 자산 ────────────────────────────────────
export const INITIAL_CASH = 10_000_000;

// ── KBO 팀 매핑 (외부 API 팀명 → 내부 short_name) ──
export const KBO_TEAM_MAP: Record<string, string> = {
  "LG": "LG", "두산": "두산", "KIA": "KIA", "삼성": "삼성",
  "SSG": "SSG", "롯데": "롯데", "KT": "KT", "키움": "키움",
  "NC": "NC", "한화": "한화",
  // 외부 API에서 다른 이름으로 오는 경우
  "엘지": "LG", "기아": "KIA",
};


// ── 경기 데이터 Provider 설정 (환경변수로 제어) ──────
// .env 에 GAME_PROVIDER=mock | naver | statiz | auto(기본값) 설정 가능
// CRON_SECRET 설정 시 /api/games/sync GET 요청에 Bearer 토큰 필요
export const GAME_SYNC = {
  DEFAULT_PROVIDER_MODE: "auto" as const,
  SYNC_INTERVAL_MS: 60_000, // 클라이언트 폴링 권장 주기 (1분)
};

// ── 네이버 스포츠 API 요청 설정 (v7, 현재 미사용 — 아래 TVING_API 참고) ──
//
// [중요] 아래 URL은 실제 브라우저 Network 탭에서 캡처한 값이 아니라
// 기존 v6 코드에 있던 추정치를 그대로 옮겨온 것입니다 (검증되지 않음).
// v8부터는 기본 우선순위에서 naver를 빼고 tving을 사용합니다.
// (네이버는 2024년부터 KBO 중계권이 없어 데이터 안정성이 떨어짐 — TVING이 2024~2031 뉴미디어 중계권 보유)
// GAME_PROVIDER=naver 로 명시적으로 지정하면 여전히 사용은 가능합니다.
export const NAVER_API = {
  GAMES_URL:
    process.env.NAVER_GAMES_URL ??
    "https://api-gw.sports.naver.com/schedule/games?fields=basic,broadcast&fromDate={date}&toDate={date}&categoryId=kbo",
  STANDINGS_URL:
    process.env.NAVER_STANDINGS_URL ??
    "https://api-gw.sports.naver.com/standings/kbo?season={year}",
  HEADERS: {
    "User-Agent":
      process.env.NAVER_UA ??
      "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "Accept": process.env.NAVER_ACCEPT ?? "application/json, text/plain, */*",
    "Accept-Language": process.env.NAVER_ACCEPT_LANGUAGE ?? "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": process.env.NAVER_REFERER ?? "https://m.sports.naver.com/kbaseball/schedule/index",
    "Origin": process.env.NAVER_ORIGIN ?? "https://m.sports.naver.com",
  } as Record<string, string>,
};

// ── TVING 스포츠 API 요청 설정 (v8, 1순위) ──────────
//
// [중요] TVING은 2024~2031 KBO 뉴미디어(온라인) 중계권을 독점 보유하고 있어
// 현재 가장 신뢰할 수 있는 실시간 데이터 소스 후보입니다.
// 다만 아래 URL/헤더는 실제 캡처값이 아닙니다 — TVING의 일정/순위 페이지는
// 완전히 클라이언트 렌더링(SPA)되어 있어 정적 요청으로는 실제 API를 알아낼 수
// 없었고, 이 환경에서 시도한 유사 엔드포인트(mkt.tving.com)는 봇 차단(WAF)에
// 걸렸습니다. 즉 캡처가 되더라도 서버(Cron)에서 반복 호출 시 차단될 가능성이
// 있다는 점을 감안해주세요.
//
// 아래 값들을 .env 에서 재정의하면 코드 수정 없이 즉시 반영됩니다.
// 캡처 방법은 MIGRATION_NOTES.md 참고.
export const TVING_API = {
  // 오늘/특정일 경기 목록 API — 실제 캡처한 URL로 교체 필요
  // 참고: 웹페이지 URL 패턴은 https://www.tving.com/sports/kbo/schedule?date=YYYYMMDD (확인됨)
  //       하지만 이건 페이지 URL이지 API가 아님 — 실제 API는 별도 도메인/경로일 가능성이 높음
  GAMES_URL: process.env.TVING_GAMES_URL ?? "",
  // 순위 API — 실제 캡처한 URL로 교체 필요
  // 참고: 웹페이지 URL 패턴은 https://www.tving.com/sports/kbo/history (확인됨)
  STANDINGS_URL: process.env.TVING_STANDINGS_URL ?? "",
  HEADERS: {
    "User-Agent":
      process.env.TVING_UA ??
      "Mozilla/5.0 (Linux; Android 14; SM-S928N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
    "Accept": process.env.TVING_ACCEPT ?? "application/json, text/plain, */*",
    "Accept-Language": process.env.TVING_ACCEPT_LANGUAGE ?? "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": process.env.TVING_REFERER ?? "https://www.tving.com/sports/kbo/schedule",
    "Origin": process.env.TVING_ORIGIN ?? "https://www.tving.com",
  } as Record<string, string>,
};
