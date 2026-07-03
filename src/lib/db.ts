/**
 * KBO STOCK - DB 연결 유틸리티 (raw pg)
 * Prisma generate 불필요. .env의 DATABASE_URL 사용.
 */

import { Pool, PoolClient } from "pg";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;

    if (!url) {
      console.error("[DB] ❌ DATABASE_URL이 설정되지 않았습니다.");
      console.error("[DB]    .env 파일 위치:", process.cwd() + "/.env");
      console.error("[DB]    예: DATABASE_URL=postgresql://kbo:kbo1234@localhost:5432/kboinvest");
      throw new Error("DATABASE_URL 환경변수가 설정되지 않았습니다.");
    }

    // 비밀번호 마스킹하여 로그 출력
    const masked = url.replace(/:([^:@]+)@/, ":****@");
    console.log("[DB] Connecting:", masked);

    pool = new Pool({
      connectionString: url,
      max:                    10,
      idleTimeoutMillis:  30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on("connect", () => {
      // 첫 연결 성공 시 로그
    });

    pool.on("error", (err) => {
      console.error("[DB] pool error:", err.message);
      // pool 재생성을 위해 null로 리셋
      pool = null;
    });
  }
  return pool;
}

// ── 쿼리 ─────────────────────────────────────────────
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  try {
    const result = await getPool().query(sql, params);
    return result.rows as T[];
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    console.error("[DB] query error:", err.message);
    if (err.code === "ECONNREFUSED") {
      console.error("[DB] ❌ PostgreSQL에 연결할 수 없습니다.");
      console.error("[DB]    PostgreSQL이 실행 중인지 확인하세요.");
      console.error("[DB]    DATABASE_URL:", process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":****@") ?? "미설정");
    }
    if (err.code === "3D000") {
      console.error("[DB] ❌ 데이터베이스가 존재하지 않습니다. DB를 먼저 생성하세요.");
    }
    if (err.code === "28P01") {
      console.error("[DB] ❌ 비밀번호가 올바르지 않습니다.");
    }
    throw e;
  }
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function execute(sql: string, params?: unknown[]): Promise<number> {
  const result = await getPool().query(sql, params);
  return result.rowCount ?? 0;
}

export async function transaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function checkConnection(): Promise<{ ok: boolean; error?: string; url?: string }> {
  try {
    await query("SELECT 1");
    const url = process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ":****@") ?? "미설정";
    return { ok: true, url };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
