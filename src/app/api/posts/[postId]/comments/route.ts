import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { requireUser } from "@/lib/session";

type Params = { params: Promise<{ postId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { postId } = await params;
  const comments = await query(`
    SELECT c.id, c.content, c.likes, c.created_at AS "createdAt",
           u.nickname AS "authorNickname", c.author_id AS "authorId"
    FROM comments c
    JOIN users u ON u.id = c.author_id
    WHERE c.post_id = $1 AND c.is_deleted = false
    ORDER BY c.created_at ASC
  `, [postId]);
  return NextResponse.json(comments);
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { postId } = await params;
    const user       = await requireUser();
    const { content } = await req.json();
    if (!content?.trim()) return NextResponse.json({ error: "내용을 입력해주세요." }, { status: 400 });

    const comment = await queryOne(
      "INSERT INTO comments (post_id, author_id, content) VALUES ($1,$2,$3) RETURNING id",
      [postId, user.id, content.trim()]
    );
    return NextResponse.json({ id: comment?.id }, { status: 201 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
