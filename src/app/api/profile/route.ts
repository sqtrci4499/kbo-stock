import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, execute } from "@/lib/db";
import { requireUser, toClientUser } from "@/lib/session";

const BCRYPT_ROUNDS = 10;

// ── PATCH: 닉네임 또는 비밀번호 변경 ─────────────
export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { nickname, currentPassword, newPassword } = body as {
      nickname?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    // 닉네임 변경
    if (nickname !== undefined) {
      const trimmed = nickname.trim();
      if (trimmed.length < 2 || trimmed.length > 20)
        return NextResponse.json({ error: "닉네임은 2~20자여야 합니다." }, { status: 400 });

      if (!/^[가-힣a-zA-Z0-9_]+$/.test(trimmed))
        return NextResponse.json({ error: "닉네임은 한글, 영문, 숫자, _만 사용 가능합니다." }, { status: 400 });

      const dup = await queryOne(
        "SELECT id FROM users WHERE nickname = $1 AND id != $2", [trimmed, user.id]
      );
      if (dup) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });

      await execute("UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2", [trimmed, user.id]);
    }

    // 비밀번호 변경
    if (currentPassword !== undefined && newPassword !== undefined) {
      if (newPassword.length < 4)
        return NextResponse.json({ error: "새 비밀번호는 4자 이상이어야 합니다." }, { status: 400 });

      const dbUser = await queryOne<{ password: string }>(
        "SELECT password FROM users WHERE id = $1", [user.id]
      );
      const currentOk = dbUser ? await bcrypt.compare(currentPassword, dbUser.password) : false;
      if (!dbUser || !currentOk)
        return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다." }, { status: 400 });

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      await execute("UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2", [newHash, user.id]);
    }

    // 최신 유저 정보 반환
    const updated = await queryOne(
      "SELECT id, nickname, email, role, status, cash, total_asset, profit_rate FROM users WHERE id = $1",
      [user.id]
    );
    return NextResponse.json(toClientUser(updated as any));
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED")
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    console.error("[PATCH /api/profile]", e);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
