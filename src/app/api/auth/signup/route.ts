import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, execute } from "@/lib/db";
import { SESSION_COOKIE, toClientUser, type DbUser } from "@/lib/session";

const INITIAL_CASH = 10_000_000;
const BCRYPT_ROUNDS = 10;

// 닉네임/이메일 유효성 검사
function validateSignup(email: string, password: string, nickname: string): string | null {
  if (!email || !password || !nickname) return "모든 필드를 입력해주세요.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "올바른 이메일 형식이 아닙니다.";
  if (password.length < 4) return "비밀번호는 4자 이상이어야 합니다.";
  if (nickname.length < 2 || nickname.length > 20) return "닉네임은 2~20자 사이여야 합니다.";
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) return "닉네임은 한글, 영문, 숫자, _만 사용 가능합니다.";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "요청 본문이 없습니다." }, { status: 400 });

    const { email, password, nickname } = body as {
      email: string; password: string; nickname: string;
    };

    const validError = validateSignup(email?.trim(), password, nickname?.trim());
    if (validError) return NextResponse.json({ error: validError }, { status: 400 });

    const normalizedEmail    = email.trim().toLowerCase();
    const normalizedNickname = nickname.trim();

    // 중복 확인
    const existEmail = await queryOne("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existEmail) return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });

    const existNick = await queryOne("SELECT id FROM users WHERE nickname = $1", [normalizedNickname]);
    if (existNick) return NextResponse.json({ error: "이미 사용 중인 닉네임입니다." }, { status: 409 });

    // 유저 생성 (비밀번호는 bcrypt로 해시하여 저장)
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const newUser = await queryOne<DbUser>(`
      INSERT INTO users (nickname, email, password, role, status, cash, total_asset)
      VALUES ($1, $2, $3, 'user', 'active', $4, $4)
      RETURNING id, nickname, email, role, status, cash, total_asset, profit_rate
    `, [normalizedNickname, normalizedEmail, passwordHash, INITIAL_CASH]);

    if (!newUser) throw new Error("유저 생성 실패");

    // 자동 로그인 (세션 쿠키 설정)
    const res = NextResponse.json(toClientUser(newUser), { status: 201 });
    res.cookies.set(SESSION_COOKIE, newUser.id, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   60 * 60 * 24 * 7,
      path:     "/",
    });
    return res;

  } catch (e) {
    console.error("[POST /api/auth/signup]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
