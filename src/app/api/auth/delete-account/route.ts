import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { queryOne, transaction } from "@/lib/db";
import { SESSION_COOKIE, requireUser } from "@/lib/session";

/**
 * 회원 탈퇴
 *
 * 정책:
 * - 비밀번호 확인 후에만 탈퇴 처리
 * - 완전 삭제(hard delete) 대신 소프트 삭제를 사용한다.
 *   이유: trades/posts/comments 등은 다른 유저의 히스토리(거래 상대방 가격 기록, 게시글 스레드)와
 *   맞물려 있어 완전 삭제 시 정합성이 깨질 수 있음.
 * - 탈퇴 시:
 *   1) 보유 포트폴리오(holdings) 전량 삭제 — 더 이상 자산으로 집계되지 않도록 함
 *   2) 체결 대기중인(pending) 주문 취소
 *   3) users.status = 'deleted' 로 변경 → 로그인 및 세션 복원 즉시 차단
 *   4) 이메일/닉네임을 익명화하여 재가입 시 중복 방지 해제 (unique 제약 유지)
 *   5) 비밀번호 해시를 무효값으로 교체 (재사용 불가)
 *   6) 세션 쿠키 제거
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => null);
    const password = body?.password as string | undefined;

    if (!password) {
      return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
    }

    const dbUser = await queryOne<{ password: string }>(
      "SELECT password FROM users WHERE id = $1", [user.id]
    );
    const passwordOk = dbUser ? await bcrypt.compare(password, dbUser.password) : false;
    if (!dbUser || !passwordOk) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 400 });
    }

    const anonymizedEmail    = `deleted+${user.id}@kbo-stock.local`;
    const anonymizedNickname = `탈퇴회원_${user.id.slice(0, 8)}`;
    const deadPasswordHash   = await bcrypt.hash(`deleted:${user.id}:${Date.now()}`, 10);

    await transaction(async (client) => {
      // 1) 보유 종목 전량 삭제 (자산 집계에서 제외)
      await client.query("DELETE FROM portfolios WHERE user_id = $1", [user.id]);

      // 2) 미체결 주문 취소
      await client.query(
        "UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE user_id = $1 AND status = 'pending'",
        [user.id]
      );

      // 3~5) 계정 비활성화 + 개인정보 익명화
      await client.query(
        `UPDATE users
         SET status = 'deleted',
             email = $1,
             nickname = $2,
             password = $3,
             updated_at = NOW()
         WHERE id = $4`,
        [anonymizedEmail, anonymizedNickname, deadPasswordHash, user.id]
      );
    });

    const res = NextResponse.json({ ok: true, message: "회원 탈퇴가 완료되었습니다." });
    res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, maxAge: 0, path: "/" });
    return res;
  } catch (e: unknown) {
    if (e instanceof Error && e.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }
    console.error("[POST /api/auth/delete-account]", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
