import { NextResponse } from "next/server";
import { getSessionUser, toClientUser } from "@/lib/session";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json(null);
    return NextResponse.json(toClientUser(user));
  } catch {
    return NextResponse.json(null);
  }
}
