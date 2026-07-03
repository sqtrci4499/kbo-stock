import { NextRequest, NextResponse } from "next/server";
import { query, execute } from "@/lib/db";
import { requireUser } from "@/lib/session";

// ── GET: 내 알림 목록 ──────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const user  = await requireUser();
    const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "20");

    const notifs = await query(`
      SELECT id, type, title, message, team_id AS "teamId",
             is_read AS "isRead", created_at AS "createdAt"
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [user.id, limit]);

    const unreadCount = await query<{ count: string }>(
      "SELECT COUNT(*) AS count FROM notifications WHERE user_id = $1 AND is_read = false",
      [user.id]
    );

    return NextResponse.json({
      notifications: notifs,
      unreadCount: parseInt(unreadCount[0]?.count ?? "0"),
    });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// ── PATCH: 전체 읽음 처리 ─────────────────────────
export async function PATCH() {
  try {
    const user = await requireUser();
    await execute(
      "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
      [user.id]
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
