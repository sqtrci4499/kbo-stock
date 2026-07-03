/**
 * KBO STOCK - DB 연결 상태 확인 API
 * 접속: GET /api/health
 * 
 * 종목시장이 비어 있을 때 먼저 이 URL을 확인하세요.
 */

import { NextResponse } from "next/server";
import { checkConnection } from "@/lib/db";
import { query } from "@/lib/db";

export async function GET() {
  const dbStatus = await checkConnection();

  if (!dbStatus.ok) {
    return NextResponse.json({
      status: "error",
      db:     dbStatus,
      env: {
        DATABASE_URL: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ":****@")
          : "❌ 미설정",
        NODE_ENV:     process.env.NODE_ENV ?? "미설정",
      },
      message: "DB 연결 실패. DATABASE_URL을 확인하세요.",
    }, { status: 503 });
  }

  // 테이블 건수 확인
  try {
    const counts = await query<{ tbl: string; cnt: string }>(`
      SELECT 'teams'       AS tbl, COUNT(*)::text AS cnt FROM teams       UNION ALL
      SELECT 'team_stats'  AS tbl, COUNT(*)::text AS cnt FROM team_stats  UNION ALL
      SELECT 'team_prices' AS tbl, COUNT(*)::text AS cnt FROM team_prices UNION ALL
      SELECT 'users'       AS tbl, COUNT(*)::text AS cnt FROM users
    `);

    const data: Record<string, number> = {};
    counts.forEach(r => { data[r.tbl] = parseInt(r.cnt); });

    const hasData = data.teams > 0;

    return NextResponse.json({
      status:   hasData ? "ok" : "empty",
      db:       { ok: true, url: dbStatus.url },
      counts:   data,
      message:  hasData
        ? `✅ 정상: ${data.teams}개 팀, ${data.team_prices}개 주가 데이터`
        : "⚠️ 데이터 없음: npm run db:seed 를 실행하세요",
      hint: !hasData
        ? "터미널에서 'npm run db:seed' 명령을 실행하면 초기 데이터가 삽입됩니다."
        : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({
      status:  "table_error",
      db:      { ok: true },
      error:   msg,
      message: "테이블이 존재하지 않습니다. npm run db:seed 를 실행하세요.",
    }, { status: 503 });
  }
}
