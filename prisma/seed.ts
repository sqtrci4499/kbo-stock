/**
 * KBO STOCK - 시드 데이터
 * 실행: npm run db:seed
 *
 * 동작 순서:
 * 1. .env 로드 → DATABASE_URL 확인
 * 2. init.sql 로 테이블 생성 (IF NOT EXISTS)
 * 3. KBO 10팀 + 스탯 + 30일 주가 히스토리
 * 4. 유저 3명 (user1, user2, admin)
 * 5. user1 테스트 포트폴리오
 */

// ── 반드시 가장 먼저: .env 로드 ──────────────────────
import * as dotenv from "dotenv";
import * as path from "path";

// 프로젝트 루트의 .env 파일 로드
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { Pool } from "pg";
import * as fs from "fs";
import bcrypt from "bcryptjs";

// ── DATABASE_URL 검증 ─────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL이 설정되지 않았습니다.");
  console.error("   .env 파일에 DATABASE_URL을 추가하거나");
  console.error("   환경변수를 직접 설정해주세요.");
  console.error("   예: DATABASE_URL=postgresql://postgres:dndshaud123@localhost:5432/kboinvest");
  process.exit(1);
}

console.log("✅ DATABASE_URL 확인:", DATABASE_URL.replace(/:([^:@]+)@/, ":****@")); // 비밀번호 마스킹

const pool = new Pool({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 10_000,
});

// ── KBO 팀 데이터 ────────────────────────────────────
const TEAMS = [
  { name: "LG 트윈스",    shortName: "LG",  logoEmoji: "⚾", colorPrimary: "#C80000", initPrice: 12500,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_LG.png" },
  { name: "두산 베어스",   shortName: "두산", logoEmoji: "🐻", colorPrimary: "#131F7E", initPrice: 9800,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_OB.png" },
  { name: "KIA 타이거즈",  shortName: "KIA", logoEmoji: "🐯", colorPrimary: "#EA0029", initPrice: 15200,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_HT.png" },
  { name: "삼성 라이온즈", shortName: "삼성", logoEmoji: "🦁", colorPrimary: "#074CA1", initPrice: 11400,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_SS.png" },
  { name: "SSG 랜더스",   shortName: "SSG", logoEmoji: "🚀", colorPrimary: "#CE0E2D", initPrice: 13800,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_SK.png" },
  { name: "롯데 자이언츠", shortName: "롯데", logoEmoji: "🎯", colorPrimary: "#002B5C", initPrice: 9100,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_LT.png" },
  { name: "KT 위즈",      shortName: "KT",  logoEmoji: "🧙", colorPrimary: "#000000", initPrice: 12000,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_KT.png" },
  { name: "키움 히어로즈", shortName: "키움", logoEmoji: "🦸", colorPrimary: "#570514", initPrice: 10500,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_WO.png" },
  { name: "NC 다이노스",   shortName: "NC",  logoEmoji: "🦕", colorPrimary: "#071D3E", initPrice: 8200,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_NC.png" },
  { name: "한화 이글스",   shortName: "한화", logoEmoji: "🦅", colorPrimary: "#F37321", initPrice: 7800,
    logoUrl: "https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/emblem/regular/2026/initial_HH.png" },
] as const;

const STATS = [
  { rank:  1, wins: 65, losses: 36, draws: 1, streak:  2, last5: "WWLWW" },
  { rank:  7, wins: 42, losses: 59, draws: 1, streak: -2, last5: "LLWLL" },
  { rank:  2, wins: 63, losses: 38, draws: 1, streak:  3, last5: "WWWLW" },
  { rank:  5, wins: 51, losses: 50, draws: 1, streak: -1, last5: "WLLWL" },
  { rank:  3, wins: 60, losses: 41, draws: 1, streak:  1, last5: "WWLWL" },
  { rank:  6, wins: 50, losses: 51, draws: 1, streak:  1, last5: "LWWLW" },
  { rank:  4, wins: 55, losses: 46, draws: 1, streak:  1, last5: "WLWLW" },
  { rank:  8, wins: 38, losses: 63, draws: 1, streak: -1, last5: "LLLWL" },
  { rank:  9, wins: 35, losses: 66, draws: 1, streak: -3, last5: "WLLLL" },
  { rank: 10, wins: 30, losses: 71, draws: 1, streak: -4, last5: "LLLLW" },
] as const;

const USERS = [
  { nickname: "야구왕",      email: "user1@kbo.com", password: "1234",  role: "user",  cash: 8750000  },
  { nickname: "삼성팬_김씨", email: "user2@kbo.com", password: "1234",  role: "user",  cash: 5200000  },
  { nickname: "관리자",      email: "admin@kbo.com", password: "admin", role: "admin", cash: 10000000 },
] as const;

function dateStr(d: Date): string {
  // 로컬 타임존 문제 방지: UTC 기준 날짜 문자열
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("\n🌱 KBO STOCK 시드 데이터 시작...\n");

  // ── 연결 테스트 ─────────────────────────────────────
  console.log("🔌 DB 연결 테스트...");
  const client = await pool.connect();
  await client.query("SELECT 1");
  client.release();
  console.log("✅ DB 연결 성공\n");

  // ── 스키마 초기화 ────────────────────────────────────
  const sqlPath = path.resolve(__dirname, "init.sql");
  if (!fs.existsSync(sqlPath)) throw new Error(`init.sql 파일이 없습니다: ${sqlPath}`);
  const initSQL = fs.readFileSync(sqlPath, "utf8");
  await pool.query(initSQL);
  console.log("✅ 스키마(테이블) 초기화 완료\n");

  // ── 팀 + 스탯 + 주가 ────────────────────────────────
  console.log("⚾ KBO 팀 데이터 삽입...");
  const teamIds: Record<string, string> = {};

  for (let i = 0; i < TEAMS.length; i++) {
    const t = TEAMS[i];
    const s = STATS[i];

    // 팀 upsert
    const teamRes = await pool.query<{ id: string }>(
      `INSERT INTO teams (name, short_name, logo_emoji, color_primary, logo_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (short_name) DO UPDATE SET
         name          = EXCLUDED.name,
         logo_emoji    = EXCLUDED.logo_emoji,
         color_primary = EXCLUDED.color_primary,
         logo_url       = EXCLUDED.logo_url
       RETURNING id`,
      [t.name, t.shortName, t.logoEmoji, t.colorPrimary, t.logoUrl]
    );
    const teamId = teamRes.rows[0].id;
    teamIds[t.shortName] = teamId;

    // 팀 스탯 upsert
    const total   = s.wins + s.losses + s.draws;
    const winRate = total > 0 ? s.wins / total : 0;
    await pool.query(
      `INSERT INTO team_stats (team_id, rank, wins, losses, draws, win_rate, streak, last5)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (team_id) DO UPDATE SET
         rank = EXCLUDED.rank, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
         draws = EXCLUDED.draws, win_rate = EXCLUDED.win_rate,
         streak = EXCLUDED.streak, last5 = EXCLUDED.last5, updated_at = NOW()`,
      [teamId, s.rank, s.wins, s.losses, s.draws, winRate, s.streak, s.last5]
    );

    // 30일 주가 히스토리
    let price = t.initPrice * 0.85;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let d = 30; d >= 0; d--) {
      const dt = new Date(today);
      dt.setDate(dt.getDate() - d);

      const prev    = price;
      const factor  = 1 + (Math.random() - 0.47) * 0.06;
      price         = Math.max(prev * factor, 1000);
      const chgRate = (price - prev) / prev;

      await pool.query(
        `INSERT INTO team_prices
           (team_id, date, open, high, low, close, prev_close, change_rate, volume)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (team_id, date) DO NOTHING`,
        [
          teamId, dateStr(dt),
          Math.round(prev),
          Math.round(Math.max(prev, price) * 1.01),
          Math.round(Math.min(prev, price) * 0.99),
          Math.round(price),
          Math.round(prev),
          chgRate,
          Math.floor(Math.random() * 50000) + 5000,
        ]
      );
    }

    console.log(`  ✅ ${t.name.padEnd(12)} (ID: ${teamId.slice(0, 8)}...) 현재가: ${Math.round(price).toLocaleString()}원`);
  }

  // ── 유저 생성 (비밀번호는 bcrypt로 해시하여 저장) ──────
  console.log("\n👤 유저 생성...");
  for (const u of USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await pool.query(
      `INSERT INTO users (nickname, email, password, role, status, cash, total_asset)
       VALUES ($1, $2, $3, $4, 'active', $5, $5)
       ON CONFLICT (email) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         password = EXCLUDED.password,
         role     = EXCLUDED.role,
         status   = 'active'`,
      [u.nickname, u.email, passwordHash, u.role, u.cash]
    );
    console.log(`  ✅ ${u.nickname.padEnd(12)} | ${u.email} | pw: ${u.password} (bcrypt로 저장됨)`);
  }

  // ── 테스트 포트폴리오 ────────────────────────────────
  console.log("\n💼 테스트 포트폴리오 생성...");
  const user1Row = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1", ["user1@kbo.com"]
  );
  const user1Id = user1Row.rows[0]?.id;
  const lgId    = teamIds["LG"];
  const kiaId   = teamIds["KIA"];

  if (user1Id && lgId && kiaId) {
    const lgPrice  = await pool.query<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id = $1 ORDER BY date DESC LIMIT 1", [lgId]
    );
    const kiaPrice = await pool.query<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id = $1 ORDER BY date DESC LIMIT 1", [kiaId]
    );
    const lgClose  = lgPrice.rows[0]?.close  ?? 10000;
    const kiaClose = kiaPrice.rows[0]?.close ?? 10000;
    const lgAvg    = Math.round(lgClose  * 0.88);
    const kiaAvg   = Math.round(kiaClose * 0.91);

    await pool.query(
      `INSERT INTO portfolios (user_id, team_id, quantity, avg_buy_price, total_invested)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, team_id) DO UPDATE SET
         quantity=EXCLUDED.quantity, avg_buy_price=EXCLUDED.avg_buy_price,
         total_invested=EXCLUDED.total_invested, updated_at=NOW()`,
      [user1Id, lgId,  50, lgAvg,  lgAvg  * 50]
    );
    await pool.query(
      `INSERT INTO portfolios (user_id, team_id, quantity, avg_buy_price, total_invested)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, team_id) DO UPDATE SET
         quantity=EXCLUDED.quantity, avg_buy_price=EXCLUDED.avg_buy_price,
         total_invested=EXCLUDED.total_invested, updated_at=NOW()`,
      [user1Id, kiaId, 30, kiaAvg, kiaAvg * 30]
    );
    console.log("  ✅ user1: LG 50주, KIA 30주");
  }

  // ── 최종 검증 ────────────────────────────────────────
  console.log("\n📊 DB 데이터 검증...");
  const counts = await pool.query<{ tbl: string; cnt: string }>(`
    SELECT 'teams'       AS tbl, COUNT(*)::text AS cnt FROM teams       UNION ALL
    SELECT 'team_stats'  AS tbl, COUNT(*)::text AS cnt FROM team_stats  UNION ALL
    SELECT 'team_prices' AS tbl, COUNT(*)::text AS cnt FROM team_prices UNION ALL
    SELECT 'users'       AS tbl, COUNT(*)::text AS cnt FROM users       UNION ALL
    SELECT 'portfolios'  AS tbl, COUNT(*)::text AS cnt FROM portfolios
  `);
  counts.rows.forEach(r => console.log(`  ${r.tbl.padEnd(14)}: ${r.cnt}건`));

  // JOIN 쿼리 실제 테스트
  const joinTest = await pool.query(`
    SELECT t.name, COALESCE(tp.close, 10000) AS price, COALESCE(ts.rank, 99) AS rank
    FROM teams t
    LEFT JOIN team_stats ts ON ts.team_id = t.id
    LEFT JOIN LATERAL (
      SELECT close FROM team_prices WHERE team_id = t.id ORDER BY date DESC LIMIT 1
    ) tp ON true
    WHERE t.is_active = true
    ORDER BY COALESCE(ts.rank, 99)
    LIMIT 3
  `);
  console.log(`\n  JOIN 쿼리 테스트: ${joinTest.rows.length}건 반환`);
  joinTest.rows.forEach(r => console.log(`    - ${r.name}: ${Math.round(r.price).toLocaleString()}원 (${r.rank}위)`));

  console.log("\n🎉 시드 완료!\n");
  console.log("  로그인 계정:");
  console.log("  일반: user1@kbo.com / 1234");
  console.log("  관리자: admin@kbo.com / admin\n");
}

main()
  .catch((e: Error) => {
    console.error("\n❌ 시드 실패:", e.message);
    console.error(e.stack);
    process.exit(1);
  })
  .finally(() => pool.end());
