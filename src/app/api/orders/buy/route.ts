import { NextRequest, NextResponse } from "next/server";
import { getTradeStatus } from "@/lib/tradeSession";
import { queryOne, transaction } from "@/lib/db";
import { requireUser, toClientUser } from "@/lib/session";
import { recalcUserAsset } from "@/lib/priceEngine";
import type { PoolClient } from "pg";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    // 거래 가능 시간 확인 (월요일만)
    const tradeStatus = await getTradeStatus();
    if (!tradeStatus.isOpen) {
      return NextResponse.json(
        { error: tradeStatus.reason, opensAt: tradeStatus.opensAt },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body?.teamId || !body?.quantity) {
      return NextResponse.json({ error: "teamId, quantity 는 필수입니다." }, { status: 400 });
    }

    const { teamId } = body as { teamId: string };
    const quantity   = Math.floor(Number(body.quantity));

    if (quantity < 1) {
      return NextResponse.json({ error: "수량은 1주 이상이어야 합니다." }, { status: 400 });
    }

    // 현재가 조회
    const latest = await queryOne<{ close: number }>(
      "SELECT close FROM team_prices WHERE team_id = $1 ORDER BY date DESC LIMIT 1",
      [teamId]
    );
    if (!latest) {
      return NextResponse.json({ error: "주가 정보가 없습니다." }, { status: 400 });
    }

    const price       = latest.close;
    const totalAmount = Math.round(price * quantity);
    const userCash    = Number(user.cash);

    if (userCash < totalAmount) {
      return NextResponse.json(
        { error: `잔액이 부족합니다. (필요: ${totalAmount.toLocaleString()}원, 보유: ${userCash.toLocaleString()}원)` },
        { status: 400 }
      );
    }

    const result = await transaction(async (client: PoolClient) => {
      // 현금 차감
      await client.query(
        "UPDATE users SET cash = cash - $1, updated_at = NOW() WHERE id = $2",
        [totalAmount, user.id]
      );

      // 주문 생성
      const orderRes = await client.query<{ id: string }>(
        `INSERT INTO orders
           (user_id, team_id, order_type, price_type, quantity, filled_qty, status)
         VALUES ($1, $2, 'buy', 'market', $3, $3, 'filled')
         RETURNING id`,
        [user.id, teamId, quantity]
      );
      const orderId = orderRes.rows[0].id;

      // 체결 기록
      await client.query(
        `INSERT INTO trades
           (order_id, user_id, team_id, trade_type, price, quantity, total_amount)
         VALUES ($1, $2, $3, 'buy', $4, $5, $6)`,
        [orderId, user.id, teamId, price, quantity, totalAmount]
      );

      // 포트폴리오 upsert
      const existing = await client.query<{
        quantity: number; avg_buy_price: number; total_invested: number;
      }>(
        "SELECT quantity, avg_buy_price, total_invested FROM portfolios WHERE user_id = $1 AND team_id = $2",
        [user.id, teamId]
      );

      if (existing.rows.length > 0) {
        const e         = existing.rows[0];
        const newQty    = e.quantity + quantity;
        const newTotal  = Number(e.total_invested) + totalAmount;
        const newAvg    = newTotal / newQty;
        await client.query(
          `UPDATE portfolios
           SET quantity = $1, avg_buy_price = $2, total_invested = $3, updated_at = NOW()
           WHERE user_id = $4 AND team_id = $5`,
          [newQty, newAvg, newTotal, user.id, teamId]
        );
      } else {
        await client.query(
          `INSERT INTO portfolios
             (user_id, team_id, quantity, avg_buy_price, total_invested)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, teamId, quantity, price, totalAmount]
        );
      }

      // 보유자 수 갱신
      const hcRow = await client.query<{ count: string }>(
        "SELECT COUNT(*) AS count FROM portfolios WHERE team_id = $1 AND quantity > 0",
        [teamId]
      );
      await client.query(
        "UPDATE team_stats SET holder_count = $1 WHERE team_id = $2",
        [parseInt(hcRow.rows[0].count), teamId]
      );

      // 총 자산/수익률 즉시 재계산 (다음 정산까지 기다리지 않고 랭킹에 바로 반영)
      await recalcUserAsset(client, user.id);

      const updUser = await client.query<{ cash: number }>(
        "SELECT cash FROM users WHERE id = $1",
        [user.id]
      );
      return { orderId, remainingCash: updUser.rows[0].cash };
    });

    return NextResponse.json({
      orderId:       result.orderId,
      status:        "filled",
      filledQty:     quantity,
      filledPrice:   price,
      totalAmount:   String(totalAmount),
      remainingCash: String(result.remainingCash),
    }, { status: 201 });

  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message === "UNAUTHORIZED") return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
      console.error("[POST /api/orders/buy]", e.message);
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
