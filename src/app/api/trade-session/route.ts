import { NextResponse } from "next/server";
import { getTradeStatus } from "@/lib/tradeSession";

export async function GET() {
  try {
    const status = await getTradeStatus();
    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ isOpen: false, reason: "확인 불가" });
  }
}
