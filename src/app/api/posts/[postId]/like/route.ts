import { NextRequest, NextResponse } from "next/server";
import { queryOne, execute, transaction } from "@/lib/db";
import { requireUser } from "@/lib/session";
import type { PoolClient } from "pg";

type Params = { params: Promise<{ postId: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { postId } = await params;
    const user = await requireUser();

    const result = await transaction(async (client: PoolClient) => {
      const existing = await client.query(
        "SELECT 1 FROM post_likes WHERE post_id=$1 AND user_id=$2", [postId, user.id]
      );
      if (existing.rows.length > 0) {
        await client.query("DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2", [postId, user.id]);
        await client.query("UPDATE posts SET likes = likes - 1 WHERE id=$1", [postId]);
        return { liked: false };
      } else {
        await client.query("INSERT INTO post_likes (post_id, user_id) VALUES ($1,$2)", [postId, user.id]);
        await client.query("UPDATE posts SET likes = likes + 1 WHERE id=$1", [postId]);
        return { liked: true };
      }
    });

    const post = await queryOne<{ likes: number }>("SELECT likes FROM posts WHERE id=$1", [postId]);
    return NextResponse.json({ ...result, likes: post?.likes ?? 0 });
  } catch (e: any) {
    if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인 필요" }, { status: 401 });
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
