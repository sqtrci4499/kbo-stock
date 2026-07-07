-- =====================================================
-- KBO STOCK - DB 초기화 SQL
-- 실행: npm run db:seed (seed.ts 내부에서 자동 실행)
-- 또는 직접: psql -U kbo -d kboinvest -f prisma/init.sql
-- =====================================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname    VARCHAR(50) UNIQUE NOT NULL,
  email       VARCHAR(255) UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'user',
  status      VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive | deleted
  cash        BIGINT      NOT NULL DEFAULT 10000000,
  total_asset BIGINT      NOT NULL DEFAULT 10000000,
  profit_rate FLOAT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 기존 DB에 이미 users 테이블이 있는 경우를 위한 안전한 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- ── teams ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(50) UNIQUE NOT NULL,
  short_name    VARCHAR(20) UNIQUE NOT NULL,
  logo_emoji    VARCHAR(10) NOT NULL DEFAULT '⚾',
  color_primary VARCHAR(7)  NOT NULL DEFAULT '#1a1a2e',
  total_shares  INT         NOT NULL DEFAULT 1000000,
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── team_prices ────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_prices (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  date        DATE        NOT NULL,
  open        FLOAT       NOT NULL,
  high        FLOAT       NOT NULL,
  low         FLOAT       NOT NULL,
  close       FLOAT       NOT NULL,
  prev_close  FLOAT,
  change_rate FLOAT       NOT NULL DEFAULT 0,
  volume      INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT team_prices_team_id_date_key UNIQUE (team_id, date)
);
CREATE INDEX IF NOT EXISTS idx_team_prices_team_date
  ON team_prices (team_id, date DESC);

-- ── team_stats ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS team_stats (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID        UNIQUE NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  rank         INT         NOT NULL DEFAULT 1,
  wins         INT         NOT NULL DEFAULT 0,
  losses       INT         NOT NULL DEFAULT 0,
  draws        INT         NOT NULL DEFAULT 0,
  win_rate     FLOAT       NOT NULL DEFAULT 0,
  run_diff     INT         NOT NULL DEFAULT 0,
  streak       INT         NOT NULL DEFAULT 0,
  last5        VARCHAR(10) NOT NULL DEFAULT '',
  holder_count INT         NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── orders ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id     UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  order_type  VARCHAR(10) NOT NULL,   -- buy | sell
  price_type  VARCHAR(10) NOT NULL,   -- market | limit
  limit_price FLOAT,
  quantity    INT         NOT NULL,
  filled_qty  INT         NOT NULL DEFAULT 0,
  status      VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | filled | cancelled
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_user_status   ON orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_team_status   ON orders (team_id, status);

-- ── trades ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS trades (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id      UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  trade_type   VARCHAR(10) NOT NULL,  -- buy | sell
  price        FLOAT       NOT NULL,
  quantity     INT         NOT NULL,
  total_amount BIGINT      NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trades_team_date ON trades (team_id, created_at DESC);

-- ── portfolios ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS portfolios (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id        UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  quantity       INT         NOT NULL DEFAULT 0,
  avg_buy_price  FLOAT       NOT NULL,
  total_invested BIGINT      NOT NULL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portfolios_user_team_key UNIQUE (user_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_portfolios_user ON portfolios (user_id);

-- ── game_results ───────────────────────────────────
CREATE TABLE IF NOT EXISTS game_results (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  home_team_id  UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  away_team_id  UUID        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  home_score    INT,
  away_score    INT,
  game_date     DATE        NOT NULL,
  status        VARCHAR(20) NOT NULL DEFAULT 'scheduled',  -- scheduled | live | final | cancelled
  price_applied BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_game_results_date ON game_results (game_date DESC);

-- ── notices (공지사항) ─────────────────────────────
CREATE TABLE IF NOT EXISTS notices (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      VARCHAR(200) NOT NULL,
  content    TEXT        NOT NULL,
  is_pinned  BOOLEAN     NOT NULL DEFAULT FALSE,
  views      INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── posts (자유게시판) ────────────────────────────
CREATE TABLE IF NOT EXISTS posts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id    UUID        REFERENCES teams(id) ON DELETE SET NULL,
  title      VARCHAR(200) NOT NULL,
  content    TEXT        NOT NULL,
  likes      INT         NOT NULL DEFAULT 0,
  views      INT         NOT NULL DEFAULT 0,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_posts_team    ON posts (team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);

-- ── comments ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID        NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  likes      INT         NOT NULL DEFAULT 0,
  is_deleted BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at ASC);

-- ── notifications ─────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(30) NOT NULL,  -- game_start | game_end | price_surge | price_drop | order_filled
  title      VARCHAR(100) NOT NULL,
  message    VARCHAR(500) NOT NULL,
  team_id    UUID        REFERENCES teams(id) ON DELETE SET NULL,
  is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, created_at DESC);

-- ── trade_sessions (거래 가능 기간 관리) ───────────
CREATE TABLE IF NOT EXISTS trade_sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  open_at     TIMESTAMPTZ NOT NULL,
  close_at    TIMESTAMPTZ NOT NULL,
  description VARCHAR(200),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── post_likes (좋아요 중복 방지) ─────────────────
CREATE TABLE IF NOT EXISTS post_likes (
  post_id   UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ── game_results 스키마 보강 (실시간 경기 수집용) ──
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS stadium      VARCHAR(50);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS inning       INT DEFAULT 0;
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS inning_half  VARCHAR(10) DEFAULT 'top'; -- top | bottom
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS start_time   TIMESTAMPTZ;
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS external_id  VARCHAR(100); -- 외부 소스 고유 ID (중복 방지)
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS source       VARCHAR(30) DEFAULT 'manual'; -- manual | naver | statiz | mock
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

-- status 체크 제약 (scheduled | live | final | cancelled | postponed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_results_status_check'
  ) THEN
    ALTER TABLE game_results
      ADD CONSTRAINT game_results_status_check
      CHECK (status IN ('scheduled','live','final','cancelled','postponed'));
  END IF;
END $$;

-- 외부 ID 중복 방지 (같은 경기를 여러 번 동기화해도 안전)
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_results_external_id
  ON game_results (external_id) WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_game_results_status ON game_results (status, game_date);

-- ── v6: 경기 상세 정보 보강 ──────────────────────────
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS game_time          VARCHAR(10);  -- "18:30" 형식
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS current_status_text VARCHAR(100);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS winner_team_id     UUID REFERENCES teams(id);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS loser_team_id      UUID REFERENCES teams(id);
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS last_synced_at     TIMESTAMPTZ;

-- ── v6: 팀 순위 동기화 메타 정보 ─────────────────────
CREATE TABLE IF NOT EXISTS standings_sync_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      VARCHAR(30) NOT NULL,
  success       BOOLEAN     NOT NULL,
  team_count    INT         DEFAULT 0,
  message       VARCHAR(300),
  synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- team_stats에 게임차(games_behind) 컬럼 추가 (요청서 5번 항목)
ALTER TABLE team_stats ADD COLUMN IF NOT EXISTS games_behind FLOAT DEFAULT 0;

-- ── v6: 네이버 스포츠 팀 엠블럼 이미지 ──────────────
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url VARCHAR(300);

-- ── v9: AI 예측 (경기센터 제거, 일일 배치 방향 전환) ──
CREATE TABLE IF NOT EXISTS ai_predictions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID        NOT NULL UNIQUE REFERENCES teams(id) ON DELETE CASCADE,
  ai_score       INT         NOT NULL DEFAULT 50,  -- 0~100
  stars          INT         NOT NULL DEFAULT 3,   -- 1~5
  recommendation VARCHAR(20) NOT NULL DEFAULT '보유', -- 적극 매수 | 매수 | 보유 | 관망 | 주의
  comment        TEXT        NOT NULL DEFAULT '',  -- AI 자동 생성 코멘트 (데이터 기반)
  admin_comment  TEXT,                              -- 관리자가 직접 작성한 야구 코멘트 (선택)
  admin_comment_updated_at TIMESTAMPTZ,             -- 관리자 코멘트 마지막 작성/수정 시각
  admin_comment_by VARCHAR(50),                     -- 작성한 관리자 닉네임
  factors        JSONB,      -- 점수 산출에 쓰인 개별 요인 (디버깅/투명성 목적)
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- 기존 DB에 이미 ai_predictions가 있는 경우를 위한 안전한 컬럼 추가
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS admin_comment TEXT;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS admin_comment_updated_at TIMESTAMPTZ;
ALTER TABLE ai_predictions ADD COLUMN IF NOT EXISTS admin_comment_by VARCHAR(50);

-- ── v9: 일일 자동 업데이트 실행 로그 (23:59 KST 배치 / 관리자 수동 실행 겸용) ──
CREATE TABLE IF NOT EXISTS daily_update_log (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  success       BOOLEAN     NOT NULL,
  games_synced  INT         DEFAULT 0,
  standings_ok  BOOLEAN     DEFAULT false,
  ai_updated    INT         DEFAULT 0,
  message       VARCHAR(300),
  detail        TEXT,
  ran_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
