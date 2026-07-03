/**
 * KBO STOCK - SSE (Server-Sent Events) 실시간 스트림
 * 클라이언트는 EventSource("/api/sse")로 구독
 * 이벤트 종류: price_update | game_update | notification | heartbeat
 */

import { NextRequest } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── 전역 클라이언트 관리 ──────────────────────────
type Client = {
  id:         string;
  controller: ReadableStreamDefaultController;
  userId?:    string;
};

const clients = new Map<string, Client>();

// 외부에서 브로드캐스트용 (priceEngine 등에서 호출)
export function broadcastPriceUpdate(data: unknown) {
  const msg = formatSSE("price_update", data);
  clients.forEach(c => {
    try { c.controller.enqueue(msg); } catch {}
  });
}

export function broadcastGameUpdate(data: unknown) {
  const msg = formatSSE("game_update", data);
  clients.forEach(c => {
    try { c.controller.enqueue(msg); } catch {}
  });
}

export function sendNotification(userId: string, data: unknown) {
  clients.forEach(c => {
    if (c.userId === userId) {
      try { c.controller.enqueue(formatSSE("notification", data)); } catch {}
    }
  });
}

function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify({ ...( data as object), at: new Date().toISOString() })}\n\n`;
}

// ── GET 핸들러 ────────────────────────────────────
export async function GET(req: NextRequest) {
  const clientId = crypto.randomUUID();
  const userId   = req.nextUrl.searchParams.get("userId") ?? undefined;

  const stream = new ReadableStream({
    start(controller) {
      clients.set(clientId, { id: clientId, controller, userId });

      // 연결 확인 메시지
      controller.enqueue(
        formatSSE("heartbeat", { clientId, connectedAt: new Date().toISOString() })
      );

      // 하트비트 (20초)
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(formatSSE("heartbeat", { ts: Date.now() }));
        } catch {
          clearInterval(heartbeat);
        }
      }, 20_000);

      // 가격 브로드캐스트 (30초 간격 — 경기 없을 때)
      const pricePush = setInterval(async () => {
        try {
          const prices = await query(`
            SELECT t.id, t.short_name AS "shortName",
                   tp.close AS "currentPrice",
                   tp.change_rate AS "changeRate",
                   tp.volume
            FROM teams t
            LEFT JOIN LATERAL (
              SELECT close, change_rate, volume
              FROM team_prices WHERE team_id = t.id
              ORDER BY date DESC LIMIT 1
            ) tp ON true
            WHERE t.is_active = true
          `);
          controller.enqueue(formatSSE("price_update", { prices }));
        } catch {
          clearInterval(pricePush);
        }
      }, 30_000);

      // 연결 종료 처리
      req.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        clearInterval(pricePush);
        clients.delete(clientId);
        try { controller.close(); } catch {}
      });
    },
    cancel() {
      clients.delete(clientId);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection":    "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
