# ⚾ KBO STOCK

> KBO 10개 구단을 가상 주식처럼 거래하는 스포츠 투자 시뮬레이션 플랫폼

---

## 🚀 로컬 실행 (3단계)

### 1. 패키지 설치
```bash
npm install
```

### 2. PostgreSQL DB 생성
```bash
# psql 접속 후
CREATE USER kbo WITH PASSWORD 'kbo1234';
CREATE DATABASE kboinvest OWNER kbo;
GRANT ALL PRIVILEGES ON DATABASE kboinvest TO kbo;
```

### 3. DB 초기화 + 시드 + 서버 실행
```bash
npm run db:seed   # 테이블 생성 + 초기 데이터
npm run dev       # http://localhost:3000
```

---

## ☁️ Vercel 배포

```bash
# 1. Vercel CLI
npm i -g vercel
vercel login

# 2. 환경변수 설정 (Supabase 또는 Neon 추천)
vercel env add DATABASE_URL

# 3. 배포
vercel --prod
```

### Supabase 연결 시 DATABASE_URL 형식
```
postgresql://postgres.[ref]:[password]@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true
```

---

## 🔑 테스트 계정

| 구분 | 이메일 | 비밀번호 | 비고 |
|------|--------|---------|------|
| 일반 유저 | user1@kbo.com | 1234 | LG·KIA 보유 중 |
| 일반 유저 | user2@kbo.com | 1234 | 신규 투자자 |
| **관리자** | admin@kbo.com | admin | 경기 입력·정산 가능 |

---

## 📁 전체 구조

```
src/
├── app/
│   ├── page.tsx              # 홈 (랜딩 + 대시보드)
│   ├── login/                # 로그인
│   ├── signup/               # 회원가입
│   ├── market/               # 종목 시장
│   ├── teams/[teamId]/       # 팀 상세 + 차트 + 거래
│   ├── portfolio/            # 내 포트폴리오
│   ├── ranking/              # 투자자 랭킹
│   ├── board/                # 커뮤니티 게시판
│   │   ├── page.tsx          # 목록
│   │   ├── write/            # 글쓰기
│   │   └── [postId]/         # 상세 + 댓글
│   ├── notice/               # 공지사항
│   ├── profile/              # 프로필 + 거래내역 + 설정
│   ├── admin/                # 관리자 (6개 탭)
│   └── api/                  # REST API (27개 엔드포인트)
├── components/
│   ├── Sidebar.tsx           # 좌측 네비 (데스크탑)
│   ├── TopBar.tsx            # 상단바 + 모바일 하단 네비
│   ├── NotificationBell.tsx  # 실시간 알림 벨
│   ├── BuySellPanel.tsx      # 매수/매도 (거래 세션 체크)
│   ├── PriceChart.tsx        # 주가 + 거래량 차트
│   ├── PriceChangeBadge.tsx  # 등락률 뱃지
│   ├── Last5Badge.tsx        # 최근 5경기
│   ├── TeamLogo.tsx          # 팀 로고
│   └── useSSE.ts             # SSE 실시간 훅
├── lib/
│   ├── db.ts                 # pg 드라이버 (query/queryOne/transaction)
│   ├── session.ts            # 쿠키 기반 세션
│   ├── priceEngine.ts        # 주가 정산 엔진
│   └── tradeSession.ts       # 거래 세션 (월요일 제한)
├── config/index.ts           # 전역 설정 (주가 규칙, Cron 주기)
├── context/AuthContext.tsx   # 인증 전역 상태
└── types/index.ts            # 공통 타입 정의
```

---

## 🔄 주가 정산 흐름

```
관리자 → 경기 결과 입력
    ↓
[주가 정산] 버튼 클릭
    ↓
priceEngine.ts 실행:
  ① 경기 성과 계산
     승리 +3% / 패배 -2% / 홈승 +0.5%
     연승 +1%/경기 / 연패 -1%/경기
     5점차+ 득점 +1.5% / 실점 -1.5%
  ② 유저 수급 반영 (30%)
     매수 > 매도 → 추가 상승
  ③ 최종 변동률 = ①×70% + ②×30%
     상한: 일반 ±15% / 포스트 ±30%
    ↓
team_prices 저장 → 전체 유저 총 자산 재계산
```

---

## 🗓 거래 규칙

- **기본:** 매주 **월요일** 00:00~23:59 (KST)
- **관리자 오버라이드:** `/admin` → 거래 세션 탭에서 수동 등록 가능

---

## 📡 실시간 (SSE)

클라이언트는 `/api/sse`를 구독하여 아래 이벤트를 수신합니다:

| 이벤트 | 내용 | 주기 |
|--------|------|------|
| `heartbeat` | 연결 유지 | 20초 |
| `price_update` | 전체 팀 시세 | 30초 |
| `game_update` | 경기 상황 | 정산 시 |
| `notification` | 개인 알림 | 이벤트 발생 시 |

---

## ⚙️ 관리자 기능 (6개 탭)

| 탭 | 기능 |
|----|------|
| ⚾ 경기 관리 | 결과 입력 + 주가 정산 |
| 💹 주가 수정 | 팀 주가 강제 조정 |
| 👤 유저 관리 | 유저 목록 + 검색 |
| 📢 공지사항 | 등록 + 상단 고정 |
| 🕐 거래 세션 | 수동 거래 시간 등록 |
| 🔄 시즌 초기화 | 포트폴리오 + 거래 전체 리셋 |

---



---


---

## ⚾ 실시간 경기 자동 수집 시스템

### 아키텍처

```
[네이버 스포츠] ──┐
[스탯티즈]    ──┼──→ Provider 체인 (우선순위 폴백) → gameSync.ts → game_results 저장
[Mock]        ──┘                                         ↓
                                              종료(final) 감지 시 자동
                                                         ↓
                                          settlePricesAfterGame() 실행
                                                         ↓
                                        team_prices 갱신 + SSE game_update 브로드캐스트
```

### Provider 우선순위 (자동 폴백)

1. **네이버 스포츠** — 1순위. 비공식 API 사용, 실패 시 빈 배열 반환
2. **스탯티즈** — 2순위. HTML 파싱, 1순위 실패 시 시도
3. **Mock** — 최종 폴백. 항상 동작하며 가상 경기를 시뮬레이션 (개발/데모용)

`.env`의 `GAME_PROVIDER` 값으로 특정 Provider만 강제 사용 가능:
```env
GAME_PROVIDER=mock    # 데모/개발 시 권장 (외부 사이트 변경에 영향 없음)
GAME_PROVIDER=naver   # 네이버만 사용
GAME_PROVIDER=auto    # 기본값. 우선순위 체인 전체 시도
```

### Graceful Degradation (장애 대응)

- 각 Provider 내부에서 네트워크 오류·타임아웃·파싱 실패를 **모두 catch**하여 빈 배열만 반환 (절대 throw 안 함)
- 한 Provider가 0건을 반환하면 **자동으로 다음 Provider** 시도
- 모든 Provider가 실패해도 시스템은 **계속 동작** (단순히 동기화할 데이터가 없을 뿐)
- 경기 1건 처리 중 오류가 나도 **다른 경기 처리는 계속 진행** (전체 동기화가 중단되지 않음)
- `/api/games/sync`는 내부 오류가 있어도 항상 `200 OK` + `errors` 배열로 응답 (Cron 재시도 폭주 방지)

### 신규 파일

| 파일 | 역할 |
|------|------|
| `src/lib/providers/types.ts` | Provider 공통 인터페이스 정의 |
| `src/lib/providers/naverProvider.ts` | 네이버 스포츠 수집기 |
| `src/lib/providers/statizProvider.ts` | 스탯티즈 수집기 (폴백) |
| `src/lib/providers/mockProvider.ts` | 가상 경기 시뮬레이터 |
| `src/lib/providers/index.ts` | Provider 매니저 (우선순위 체인) |
| `src/lib/gameSync.ts` | DB 저장 + 종료 감지 + 자동 정산 연동 |
| `src/app/api/games/today/route.ts` | 오늘 경기 목록 API |
| `src/app/api/games/sync/route.ts` | 동기화 트리거 (Cron/관리자) |
| `src/app/games/page.tsx` | 경기센터 페이지 (실시간 카드 UI) |

### 새 Provider 추가하는 방법

```typescript
// src/lib/providers/myProvider.ts
import type { GameProvider, RawGame } from "./types";

export class MyProvider implements GameProvider {
  readonly name = "my-source";
  async fetchTodayGames(): Promise<RawGame[]> {
    try {
      // 데이터 수집 로직
      return [...];
    } catch {
      return []; // 절대 throw 금지
    }
  }
}
```
```typescript
// src/lib/providers/index.ts 에 등록
import { MyProvider } from "./myProvider";
const myProvider = new MyProvider();
const PROVIDER_CHAIN = [naver, myProvider, statiz, mock]; // 원하는 순서로 삽입
```

### Vercel Cron 자동화

`vercel.json`에 1분 주기 Cron이 이미 설정되어 있습니다:
```json
{ "crons": [{ "path": "/api/games/sync", "schedule": "* * * * *" }] }
```
배포 후 별도 설정 없이 자동으로 매분 경기 데이터가 갱신됩니다.

### 관리자 수동 입력은 그대로 유지

`/admin` → 경기 관리 탭에서 기존처럼 수동으로 경기 결과를 입력하고 개별 정산하는 기능은 **변경 없이 그대로 사용 가능**합니다. 자동 동기화 패널은 그 위에 추가된 것이며, 자동/수동을 함께 사용할 수 있습니다 (자동 수집된 경기를 관리자가 다시 수정할 수도 있음).

## 🔧 트러블슈팅: 종목시장이 비어 있을 때

### 1단계 — 진단 API 확인
브라우저에서 다음 주소를 열어보세요:
```
http://localhost:3000/api/health
```

**응답 예시 (정상):**
```json
{
  "status": "ok",
  "counts": { "teams": 10, "team_stats": 10, "team_prices": 310, "users": 3 },
  "message": "✅ 정상: 10개 팀, 310개 주가 데이터"
}
```

**응답 예시 (DB 연결 실패):**
```json
{
  "status": "error",
  "db": { "ok": false, "error": "connect ECONNREFUSED 127.0.0.1:5432" },
  "message": "DB 연결 실패. DATABASE_URL을 확인하세요."
}
```
→ PostgreSQL이 꺼져 있거나 `.env`의 `DATABASE_URL`이 잘못되었습니다.

**응답 예시 (데이터 없음):**
```json
{
  "status": "empty",
  "counts": { "teams": 0, ... },
  "message": "⚠️ 데이터 없음: npm run db:seed 를 실행하세요"
}
```
→ 테이블은 있지만 비어 있습니다. `npm run db:seed`를 실행하세요.

### 2단계 — 시드 재실행 (상세 로그 포함)
```bash
npm run db:seed
```

정상 출력 예시:
```
✅ DATABASE_URL 확인: postgresql://kbo:****@localhost:5432/kboinvest
🔌 DB 연결 테스트...
✅ DB 연결 성공
✅ 스키마(테이블) 초기화 완료
⚾ KBO 팀 데이터 삽입...
  ✅ LG 트윈스      (ID: a1b2c3d4...) 현재가: 12,xxx원
  ... (10개 팀)
📊 DB 데이터 검증...
  teams         : 10건
  team_stats    : 10건
  team_prices   : 310건
  users         : 3건
  JOIN 쿼리 테스트: 3건 반환
🎉 시드 완료!
```

**만약 `DATABASE_URL이 설정되지 않았습니다` 오류가 나면:**
- 프로젝트 루트에 `.env` 파일이 있는지 확인
- `.env.example`을 복사해서 `.env`로 만들었는지 확인
```bash
cp .env.example .env
```

### 3단계 — PostgreSQL 직접 확인
```bash
psql -U kbo -d kboinvest -c "SELECT COUNT(*) FROM teams;"
```
0건이 나오면 시드가 실제로 들어가지 않은 것이므로 2단계를 다시 실행하세요.

### 흔한 원인 정리

| 증상 | 원인 | 해결 |
|------|------|------|
| seed는 성공인데 화면이 비어있음 | `ts-node`가 `.env`를 자동으로 읽지 않음 | `npm run db:seed`는 이제 `-r dotenv/config`로 강제 로드함 (수정 완료) |
| `/api/health`에서 `ECONNREFUSED` | PostgreSQL 미실행 | `pg_ctl start` 또는 서비스 시작 |
| `/api/health`에서 `28P01` | 비밀번호 오류 | `.env`의 `DATABASE_URL` 계정 정보 확인 |
| `/api/health`에서 `3D000` | DB 미생성 | `CREATE DATABASE kboinvest OWNER kbo;` 실행 |
| Prisma Studio "No database URL found" | Prisma Studio는 별개 설정 필요 | 이 프로젝트는 raw pg 사용 — Studio 대신 `psql` 또는 `/api/health` 사용 권장 |

## 🗺 다음 개선 계획

| 우선순위 | 기능 |
|---------|------|
| 🔴 | 비밀번호 bcrypt 해싱 |
| 🔴 | Supabase RLS 활성화 |
| 🟠 | KBO Open API 자동 연동 |
| 🟠 | 경기 중 실시간 이닝 주가 반영 |
| 🟡 | 지정가 주문 자동 체결 |
| 🟡 | 소셜 로그인 (Google) |
| 🟡 | 모바일 PWA |
