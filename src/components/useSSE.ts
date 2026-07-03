"use client";
import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

type SSEHandler = (data: unknown) => void;

interface SSEHandlers {
  onPriceUpdate?:   SSEHandler;
  onGameUpdate?:    SSEHandler;
  onNotification?:  SSEHandler;
  onHeartbeat?:     SSEHandler;
}

export function useSSE(handlers: SSEHandlers) {
  const { user }   = useAuth();
  const esRef      = useRef<EventSource | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = `/api/sse${user?.id ? `?userId=${user.id}` : ""}`;
    const es  = new EventSource(url);
    esRef.current = es;

    const wrap = (type: string) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        switch (type) {
          case "price_update":  handlersRef.current.onPriceUpdate?.(data);  break;
          case "game_update":   handlersRef.current.onGameUpdate?.(data);   break;
          case "notification":  handlersRef.current.onNotification?.(data); break;
          case "heartbeat":     handlersRef.current.onHeartbeat?.(data);    break;
        }
      } catch {}
    };

    ["price_update", "game_update", "notification", "heartbeat"].forEach(t =>
      es.addEventListener(t, wrap(t))
    );

    es.onerror = () => {
      es.close();
      // 5초 후 재연결
      setTimeout(connect, 5_000);
    };

    return () => es.close();
  }, [user?.id]);

  useEffect(() => {
    const cleanup = connect();
    return () => {
      cleanup?.();
      esRef.current?.close();
    };
  }, [connect]);
}
