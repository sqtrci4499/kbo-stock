import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

// ── POST: 경기 결과 등록 ──────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "요청 본문이 없습니다." }, { status: 400 });

    const { homeTeamId, awayTeamId, homeScore, awayScore, gameDate } = body as {
      homeTeamId: string; awayTeamId: string;
      homeScore:  number | string; awayScore: number | string;
      gameDate:   string;
    };

    if (!homeTeamId || !awayTeamId || homeScore === undefined || awayScore === undefined || !gameDate) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다." }, { status: 400 });
    }
    if (homeTeamId === awayTeamId) {
      return NextResponse.json({ error: "홈팀과 원정팀이 같을 수 없습니다." }, { status: 400 });
    }

    const game = await queryOne<{ id: string }>(`
      INSERT INTO game_results
        (home_team_id, away_team_id, home_score, away_score, game_date, status)
      VALUES ($1, $2, $3, $4, $5, 'final')
      RETURNING id
    `, [homeTeamId, awayTeamId, parseInt(String(homeScore)), parseInt(String(awayScore)), gameDate]);

    const homeTeam = await queryOne<{ name: string }>("SELECT name FROM teams WHERE id = $1", [homeTeamId]);
    const awayTeam = await queryOne<{ name: string }>("SELECT name FROM teams WHERE id = $1", [awayTeamId]);

    return NextResponse.json({
      id:        game?.id,
      homeTeam:  homeTeam?.name,
      awayTeam:  awayTeam?.name,
      homeScore: parseInt(String(homeScore)),
      awayScore: parseInt(String(awayScore)),
    }, { status: 201 });

  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
      console.error("[POST /api/admin/games]", e.message);
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// ── GET: 최근 경기 목록 ───────────────────────────────
export async function GET() {
  try {
    await requireAdmin();

    const games = await query(`
      SELECT
        g.id,
        g.game_date     AS "gameDate",
        g.home_score    AS "homeScore",
        g.away_score    AS "awayScore",
        g.status,
        g.price_applied AS "priceApplied",
        json_build_object('id', ht.id, 'name', ht.name) AS "homeTeam",
        json_build_object('id', at.id, 'name', at.name) AS "awayTeam"
      FROM game_results g
      JOIN teams ht ON ht.id = g.home_team_id
      JOIN teams at ON at.id = g.away_team_id
      ORDER BY g.created_at DESC
      LIMIT 30
    `);

    return NextResponse.json(games);
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
