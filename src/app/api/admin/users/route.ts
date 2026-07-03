import { NextRequest, NextResponse } from "next/server";
import { query, queryOne, execute } from "@/lib/db";
import { requireAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
    const limit = 30;
    const offset = (page - 1) * limit;
    const search = searchParams.get("search") ?? "";

    const users = await query(`
      SELECT id, nickname, email, role, status, cash, total_asset AS "totalAsset",
             profit_rate AS "profitRate", created_at AS "createdAt"
      FROM users
      WHERE ($1 = '' OR nickname ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%')
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [search, limit, offset]);

    const totalRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM users WHERE $1 = '' OR nickname ILIKE '%' || $1 || '%' OR email ILIKE '%' || $1 || '%'`,
      [search]
    );

    return NextResponse.json({ users, total: parseInt(totalRow?.count ?? "0"), page });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// ── PATCH: 권한(role) 변경 / 활성-비활성(status) 변경 ──────
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const { userId, role, status } = (body ?? {}) as {
      userId?: string; role?: string; status?: string;
    };

    if (!userId) return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    if (role && !["user", "admin"].includes(role))
      return NextResponse.json({ error: "role은 user 또는 admin이어야 합니다." }, { status: 400 });
    if (status && !["active", "inactive", "deleted"].includes(status))
      return NextResponse.json({ error: "status는 active/inactive/deleted 중 하나여야 합니다." }, { status: 400 });
    if (!role && !status)
      return NextResponse.json({ error: "변경할 role 또는 status가 필요합니다." }, { status: 400 });

    // 관리자가 자기 자신의 권한/상태를 낮추는 실수를 방지
    if (userId === admin.id && ((role && role !== "admin") || (status && status !== "active")))
      return NextResponse.json({ error: "본인 계정의 권한/상태는 변경할 수 없습니다." }, { status: 400 });

    const target = await queryOne<{ id: string }>("SELECT id FROM users WHERE id = $1", [userId]);
    if (!target) return NextResponse.json({ error: "대상 유저를 찾을 수 없습니다." }, { status: 404 });

    if (role) await execute("UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2", [role, userId]);
    if (status) await execute("UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2", [status, userId]);

    const updated = await queryOne(
      `SELECT id, nickname, email, role, status, cash, total_asset AS "totalAsset",
              profit_rate AS "profitRate", created_at AS "createdAt"
       FROM users WHERE id = $1`,
      [userId]
    );
    return NextResponse.json({ ok: true, user: updated });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    console.error("[PATCH /api/admin/users]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// ── DELETE: 관리자에 의한 강제 탈퇴 처리 (소프트 삭제) ──────
export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    if (userId === admin.id)
      return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 });

    const target = await queryOne<{ id: string }>("SELECT id FROM users WHERE id = $1", [userId]);
    if (!target) return NextResponse.json({ error: "대상 유저를 찾을 수 없습니다." }, { status: 404 });

    // 회원 탈퇴와 동일한 정책(소프트 삭제)을 적용 — 거래 히스토리 정합성 보존
    await execute("DELETE FROM portfolios WHERE user_id = $1", [userId]);
    await execute(
      "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1 AND status = 'pending'",
      [userId]
    );
    await execute(
      `UPDATE users
       SET status = 'deleted',
           email = 'deleted+' || id::text || '@kbo-stock.local',
           nickname = '탈퇴회원_' || substr(id::text, 1, 8),
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN")
      return NextResponse.json({ error: "권한 없음" }, { status: 403 });
    console.error("[DELETE /api/admin/users]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
