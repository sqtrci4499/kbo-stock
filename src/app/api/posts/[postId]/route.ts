import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute } from "@/lib/db";
import { getSessionUser, requireUser } from "@/lib/session";

type Params = { params: Promise<{ postId: string }> };

// ── GET: 게시글 상세 ──────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { postId } = await params;

  const post = await queryOne(`
    SELECT p.*, u.nickname AS "authorNickname", t.short_name AS "teamShortName"
    FROM posts p
    JOIN users u ON u.id = p.author_id
    LEFT JOIN teams t ON t.id = p.team_id
    WHERE p.id = $1 AND p.is_deleted = false
  `, [postId]);

  if (!post) return NextResponse.json({ error: "없는 게시글입니다." }, { status: 404 });

  // 조회수 증가
  await execute("UPDATE posts SET views = views + 1 WHERE id = $1", [postId]);

  return NextResponse.json(post);
}

// ── DELETE: 게시글 삭제 ───────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { postId } = await params;
    const user = await requireUser();

    const post = await queryOne<{ author_id: string }>(
      "SELECT author_id FROM posts WHERE id = $1", [postId]
    );
    if (!post) return NextResponse.json({ error: "없는 게시글" }, { status: 404 });
    if (post.author_id !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    }

    await execute("UPDATE posts SET is_deleted = true WHERE id = $1", [postId]);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
