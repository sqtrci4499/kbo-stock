import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/session";

// ── GET: 게시글 목록 ──────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")   ?? "1"));
  const limit  = Math.min(30, parseInt(searchParams.get("limit") ?? "20"));
  const teamId = searchParams.get("teamId");
  const offset = (page - 1) * limit;

  const posts = await query(`
    SELECT
      p.id, p.title, p.likes, p.views, p.created_at AS "createdAt",
      p.team_id AS "teamId",
      u.nickname AS "authorNickname",
      t.short_name AS "teamShortName",
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_deleted = false)::INT AS "commentCount"
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN teams t ON t.id = p.team_id
    WHERE p.is_deleted = false
      ${teamId ? "AND p.team_id = $3" : ""}
    ORDER BY p.created_at DESC
    LIMIT $1 OFFSET $2
  `, teamId ? [limit, offset, teamId] : [limit, offset]);

  const totalRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count FROM posts WHERE is_deleted = false ${teamId ? "AND team_id = $1" : ""}`,
    teamId ? [teamId] : []
  );

  return NextResponse.json({
    posts,
    total: parseInt(totalRow?.count ?? "0"),
    page, limit,
  });
}

// ── POST: 게시글 작성 ─────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const { title, content, teamId } = await req.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "제목과 내용을 입력해주세요." }, { status: 400 });
    }
    if (title.trim().length > 200) {
      return NextResponse.json({ error: "제목은 200자 이하입니다." }, { status: 400 });
    }

    const post = await queryOne(`
      INSERT INTO posts (author_id, team_id, title, content)
      VALUES ($1, $2, $3, $4) RETURNING id
    `, [user.id, teamId ?? null, title.trim(), content.trim()]);

    return NextResponse.json({ id: post?.id }, { status: 201 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
