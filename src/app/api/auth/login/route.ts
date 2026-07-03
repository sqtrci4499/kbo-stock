import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne } from "@/lib/db";
import { SESSION_COOKIE, toClientUser, type DbUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.email || !body?.password) {
      return NextResponse.json(
        { error: "이메일과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    const { email, password } = body as { email: string; password: string };

    // DB에서 유저 조회 후 bcrypt로 비밀번호 비교
    const userRow = await queryOne<DbUser & { password: string }>(
      `SELECT id, nickname, email, role, status, password, cash, total_asset, profit_rate
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    const passwordOk = userRow ? await bcrypt.compare(password, userRow.password) : false;

    if (!userRow || !passwordOk) {
      return NextResponse.json(
        { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    if (userRow.status !== "active") {
      return NextResponse.json(
        { error: "비활성화되었거나 탈퇴한 계정입니다. 관리자에게 문의해주세요." },
        { status: 403 }
      );
    }

    const { password: _pw, ...user } = userRow;

    // 쿠키에 세션 저장
    const res = NextResponse.json(toClientUser(user));
    res.cookies.set(SESSION_COOKIE, user.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7, // 7일
      path:     "/",
    });

    return res;
  } catch (e) {
    console.error("[POST /api/auth/login]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
