import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET() {
  const notices = await query(
    `SELECT n.*, u.nickname AS "authorNickname"
     FROM notices n JOIN users u ON u.id = n.author_id
     ORDER BY is_pinned DESC, created_at DESC LIMIT 30`
  );
  return NextResponse.json(notices);
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { title, content, isPinned } = await req.json();
    if (!title?.trim() || !content?.trim())
      return NextResponse.json({ error: "제목과 내용 필수" }, { status: 400 });

    const row = await queryOne(
      `INSERT INTO notices (author_id, title, content, is_pinned)
       VALUES ($1,$2,$3,$4) RETURNING id`,
      [admin.id, title.trim(), content.trim(), isPinned ?? false]
    );
    return NextResponse.json({ id: row?.id }, { status: 201 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
