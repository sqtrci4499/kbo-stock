import { NextRequest, NextResponse } from "next/server";
import { query, queryOne } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { openAt, closeAt, description } = await req.json();
    if (!openAt || !closeAt) {
      return NextResponse.json({ error: "openAt, closeAt 필수" }, { status: 400 });
    }
    const row = await queryOne(
      `INSERT INTO trade_sessions (open_at, close_at, description)
       VALUES ($1, $2, $3) RETURNING id`,
      [openAt, closeAt, description ?? "관리자 수동 세션"]
    );
    return NextResponse.json({ ok: true, id: row?.id }, { status: 201 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

export async function GET() {
  try {
    await requireAdmin();
    const sessions = await query(
      "SELECT * FROM trade_sessions ORDER BY created_at DESC LIMIT 20"
    );
    return NextResponse.json(sessions);
  } catch {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  }
}
