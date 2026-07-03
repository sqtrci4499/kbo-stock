# v18 → v19 변경 사항 (2026-07-03)

## 질문에 대한 답변

**1. 로그인 화면 테스트 계정 — 맞습니다, 제거했습니다.**
`src/app/login/page.tsx`에서 "🚀 테스트 계정으로 빠른 시작" 버튼 3개(user1/user2/admin)를
완전히 제거했습니다. 실제 서비스 화면에 로그인 정보를 노출하는 건 좋지 않아서요.
단, DB의 테스트 계정 자체(`user1@kbo.com`, `user2@kbo.com`, `admin@kbo.com`)는 지우지
않았습니다 — `admin@kbo.com`은 관리자 페이지 접근용으로 최소 하나는 필요하고,
개발/테스트용으로 남겨둬도 화면에 노출만 안 되면 문제 없기 때문입니다.
필요 없으시면 `prisma/seed.ts`의 `USERS` 배열에서 직접 지우시면 됩니다.

**2. 일반 유저 가입/거래 — 네, 가능합니다.**
- `/signup`에서 닉네임/이메일/비밀번호로 가입 → bcrypt 해시로 저장 → 가입 즉시 자동 로그인
- 로그인은 HttpOnly 세션 쿠키 기반, 새로고침해도 유지됨
- 가입 시 1,000만원 시드 자산 지급, `/market`에서 매수/매도 가능
  (단, 매매는 월요일에만 가능하도록 `tradeSession.ts`에서 제한 중 — 기존 정책 그대로 유지)
- 즉, 지금 이 서비스는 실제로 아무나 가입해서 가상 주식 거래를 할 수 있는 상태입니다.

## 3. 종목시장 가격을 실제 순위 기준으로 재정렬

기존에는 시드 시점의 임의 가격(팀 성적과 무관)에서 시작해서 경기당 증분(%)만 계속
쌓이는 구조라, 시간이 지나며 실제 순위와 주가 순서가 어긋날 수 있었습니다. 이를 바로잡는
"재정렬" 기능을 새로 만들었습니다.

### 공식 (승률 기준 공정가)

```
공정가 = max(3,000원, round(10,000원 × (1 + (승률-0.5) × 2)))
```

| 팀 | 승률 | 재정렬 후 가격 |
|---|---|---|
| LG | 0.625 | 12,500원 |
| 삼성 | 0.597 | 11,940원 |
| KT | 0.571 | 11,420원 |
| KIA | 0.557 | 11,140원 |
| 두산 | 0.506 | 10,120원 |
| 한화 | 0.500 | 10,000원 (기준) |
| NC | 0.468 | 9,360원 |
| 롯데 | 0.442 | 8,840원 |
| SSG | 0.390 | 7,800원 |
| 키움 | 0.346 | 6,920원 |

실제 최신 순위표(2026.07.02 기준) 승률로 직접 계산해서 검증함 — 순위 순서와 가격 순서가
정확히 일치하고, 기존 시드 가격 범위(6천~1만3천원대)와도 비슷한 스케일로 나옵니다.

### 구현
- `src/lib/priceEngine.ts`에 `realignPricesToStandings()` 신규 추가
- `src/config/index.ts`에 `STANDINGS_ALIGNMENT` 설정 추가 (기준가/민감도/최저가 방어선을
  여기서 조정 가능)
- **일일 업데이트 파이프라인에 자동 포함**: `dailyUpdate.ts`가 이제
  경기결과 → 순위갱신 → **가격재정렬(신규)** → 자산재계산 → AI예측 순서로 실행됩니다.
  즉 매일 23:59 배치에서 자동으로 가격이 순위에 맞게 재정렬됩니다.
- 관리자 페이지에 "⚖️ 순위 기준 가격 재정렬" 버튼 추가 (개별 실행도 가능,
  `POST /api/admin/price/realign`)

## 변경된 파일
- `src/app/login/page.tsx` — 테스트 계정 UI 제거
- `src/lib/priceEngine.ts` — `realignPricesToStandings()` 추가
- `src/lib/dailyUpdate.ts` — 파이프라인에 가격 재정렬 단계 추가
- `src/config/index.ts` — `STANDINGS_ALIGNMENT` 설정 추가
- `src/app/api/admin/price/realign/route.ts` — 신규 API
- `src/app/admin/page.tsx` — "가격 재정렬" 버튼 추가

## 검증
- 가격 재정렬 공식을 실제 최신 순위표 승률로 직접 계산해 순서/스케일 검증함
- `npx tsc --noEmit` 통과
- `npx next build` 프로덕션 빌드 성공

---

# v20 → v21 변경 사항 (2026-07-03) — Vercel 빌드 실패 수정

## 증상
Vercel 배포 시 `postcss.ts` 단계에서 모듈을 못 찾는 에러로 빌드 실패:
```
Require stack: .../postcss.ts ... Import trace: ./src/app/globals.css
Error: Command "npm run build" exited with 1
```

## 원인
Vercel 프로젝트 Environment Variables에 `NODE_ENV=production`을 수동으로 추가했던 것이
원인입니다. `npm install`이 빌드 시점에 `NODE_ENV=production`을 보면 **devDependencies
설치를 건너뜁니다.** `tailwindcss`/`@tailwindcss/postcss`가 devDependencies에 있었는데,
이 두 패키지는 CSS 빌드에 실제로 필요해서 설치가 안 되니 빌드가 깨졌습니다.

Vercel은 원래 런타임에 `NODE_ENV=production`을 자동으로 설정해주기 때문에, 수동으로
추가한 게 오히려 `npm install` 단계에서 부작용을 일으킨 것입니다.

## 해결
1. **`package.json`**: `tailwindcss`, `@tailwindcss/postcss`를 `devDependencies` →
   `dependencies`로 이동 — `NODE_ENV` 값과 무관하게 항상 설치되도록 함
2. **Vercel 프로젝트 설정에서 `NODE_ENV` 환경변수를 직접 제거해주세요** (Settings →
   Environment Variables → NODE_ENV 삭제). Vercel이 알아서 관리하므로 수동 설정 불필요.

## 검증
- 로컬에서 `NODE_ENV=production npm install` + `NODE_ENV=production npx next build`로
  Vercel과 동일한 조건을 재현해서 정상 빌드되는 것 확인함
