import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { query } from "@/lib/db";

/**
 * 관리자가 팀별 코멘트를 작성/수정하는 화면에서 쓰는 목록 조회 API.
 * 매주 일요일 저녁~월요일 장 시작 전에 작성하는 걸 권장 (월요일에만 매매 가능하므로).
 */
export async function GET() {
  try {
    await requireAdmin();
    const rows = await query(`
      SELECT
        t.id            AS "teamId",
        t.name,
        t.short_name    AS "shortName",
        t.logo_emoji    AS "logoEmoji",
        t.logo_url      AS "logoUrl",
        ap.admin_comment              AS "adminComment",
        ap.admin_comment_updated_at   AS "adminCommentUpdatedAt",
        ap.admin_comment_by           AS "adminCommentBy"
      FROM teams t
      LEFT JOIN ai_predictions ap ON ap.team_id = t.id
      WHERE t.is_active = true
      ORDER BY t.name ASC
    `);
    return NextResponse.json(rows);
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
