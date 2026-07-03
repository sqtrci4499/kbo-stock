import { NextRequest, NextResponse } from "next/server";
import { getTradeStatus } from "@/lib/tradeSession";
import { queryOne, transaction } from "@/lib/db";
import { requireUser } from "@/lib/session";
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

    // 보유 수량 확인
    const portfolio = await queryOne<{
      quantity: number; avg_buy_price: number; total_invested: number;
    }>(
      "SELECT quantity, avg_buy_price, total_invested FROM portfolios WHERE user_id = $1 AND team_id = $2",
      [user.id, teamId]
    );

    if (!portfolio || portfolio.quantity < quantity) {
      return NextResponse.json(
        { error: `보유 수량이 부족합니다. (보유: ${portfolio?.quantity ?? 0}주, 매도 요청: ${quantity}주)` },
        { status: 400 }
      );
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

    const result = await transaction(async (client: PoolClient) => {
      // 현금 증가
      await client.query(
        "UPDATE users SET cash = cash + $1, updated_at = NOW() WHERE id = $2",
        [totalAmount, user.id]
      );

      // 주문 생성
      const orderRes = await client.query<{ id: string }>(
        `INSERT INTO orders
           (user_id, team_id, order_type, price_type, quantity, filled_qty, status)
         VALUES ($1, $2, 'sell', 'market', $3, $3, 'filled')
         RETURNING id`,
        [user.id, teamId, quantity]
      );
      const orderId = orderRes.rows[0].id;

      // 체결 기록
      await client.query(
        `INSERT INTO trades
           (order_id, user_id, team_id, trade_type, price, quantity, total_amount)
         VALUES ($1, $2, $3, 'sell', $4, $5, $6)`,
        [orderId, user.id, teamId, price, quantity, totalAmount]
      );

      // 포트폴리오 업데이트
      const newQty = portfolio.quantity - quantity;
      if (newQty <= 0) {
        await client.query(
          "DELETE FROM portfolios WHERE user_id = $1 AND team_id = $2",
          [user.id, teamId]
        );
      } else {
        const soldCost  = Math.round(portfolio.avg_buy_price * quantity);
        const newTotal  = Number(portfolio.total_invested) - soldCost;
        await client.query(
          `UPDATE portfolios
           SET quantity = $1, total_invested = $2, updated_at = NOW()
           WHERE user_id = $3 AND team_id = $4`,
          [newQty, Math.max(0, newTotal), user.id, teamId]
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
      console.error("[POST /api/orders/sell]", e.message);
    }
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
