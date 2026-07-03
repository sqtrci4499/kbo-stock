import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { settlePricesAfterGame } from "@/lib/priceEngine";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    await requireAdmin();
    const { gameId } = await params;
    const results = await settlePricesAfterGame(gameId);
    return NextResponse.json({ ok: true, results });
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message === "UNAUTHORIZED" || e.message === "FORBIDDEN") {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
      }
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
