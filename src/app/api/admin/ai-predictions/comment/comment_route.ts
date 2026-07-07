import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { execute } from "@/lib/db";

const MAX_LEN = 300;

/**
 * 관리자가 팀별 야구 코멘트를 작성/수정한다.
 * AI 예측 재생성(regenerateAiPredictions) 시 이 코멘트가 자동 코멘트와 함께 표시되며,
 * 재생성 로직이 이 값을 덮어쓰지 않는다 (comment 컬럼과 완전히 분리 보관).
 */
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const { teamId, comment } = (body ?? {}) as { teamId?: string; comment?: string };

    if (!teamId) return NextResponse.json({ error: "teamId가 필요합니다." }, { status: 400 });
    const trimmed = (comment ?? "").trim();
    if (trimmed.length > MAX_LEN) {
      return NextResponse.json({ error: `코멘트는 ${MAX_LEN}자 이내로 작성해주세요.` }, { status: 400 });
    }

    // ai_predictions 행이 아직 없는 팀(=한 번도 AI 예측이 생성 안 된 경우)도 대비해 upsert
    await execute(`
      INSERT INTO ai_predictions (team_id, admin_comment, admin_comment_updated_at, admin_comment_by)
      VALUES ($1, $2, NOW(), $3)
      ON CONFLICT (team_id) DO UPDATE SET
        admin_comment = EXCLUDED.admin_comment,
        admin_comment_updated_at = NOW(),
        admin_comment_by = EXCLUDED.admin_comment_by
    `, [teamId, trimmed.length > 0 ? trimmed : null, admin.nickname]);

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof Error && (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
