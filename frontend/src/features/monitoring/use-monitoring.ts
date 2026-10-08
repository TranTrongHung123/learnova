"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";
import { ApiError } from "@/lib/api/client";
import { applyFrame, type Frame, type Snapshot, type StreamState } from "./types";

export function useMonitoring(id: string) {
  const { session, user } = useAuth();
  const [restart, setRestart] = useState(0);
  const [view, setView] = useState<{
    id: string;
    data?: Snapshot;
    error?: unknown;
    connected: boolean;
  }>({ id, connected: false });
  useEffect(() => {
    let stopped = false,
      socket: WebSocket | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined,
      retries = 0;
    const controller = new AbortController();
    const clearWatchdog = () => {
      if (watchdog) clearTimeout(watchdog);
    };
    const armWatchdog = () => {
      clearWatchdog();
      watchdog = setTimeout(() => {
        if (socket) reconnectSocket(socket);
      }, 12000);
    };
    const retry = () => {
      if (stopped) return;
      setView((v) => ({ ...v, connected: false }));
      timer = setTimeout(() => void connect(), Math.min(15000, 1000 * 2 ** Math.min(retries++, 4)));
    };
    const reconnectSocket = (current: WebSocket) => {
      if (stopped || socket !== current) return;
      socket = undefined;
      clearWatchdog();
      current.onmessage = null;
      current.onclose = null;
      current.onerror = null;
      current.close();
      retry();
    };
    async function connect() {
      let stream: StreamState | undefined;
      try {
        const data = await session.api.request<Snapshot>(`/api/v1/exam-sessions/${id}/monitor`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        });
        if (stopped) return;
        setView({ id, data, connected: false });
        const current = await session.monitoringSocket(
          id,
          AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
        );
        if (stopped) {
          current.close();
          return;
        }
        socket = current;
        armWatchdog();
        current.onmessage = (event) => {
          if (stopped || socket !== current || !navigator.onLine) return;
          try {
            const frame = JSON.parse(event.data) as Frame;
            if (frame.sessionId !== id) throw new Error("Unexpected session");
            stream = applyFrame(stream, frame);
            retries = 0;
            armWatchdog();
            setView({ id, data: stream.snapshot, connected: true });
          } catch {
            reconnectSocket(current);
          }
        };
        current.onclose = (event) => {
          if (stopped || socket !== current) return;
          clearWatchdog();
          socket = undefined;
          if (event.code === 4403) {
            setView({ id, error: new ApiError("http", 403), connected: false });
            return;
          }
          retry();
        };
        current.onerror = () => reconnectSocket(current);
      } catch (error) {
        if (stopped) return;
        const denied = error instanceof ApiError && [401, 403, 404].includes(error.status);
        setView((v) => ({
          id,
          data: denied ? undefined : v.id === id ? v.data : undefined,
          error,
          connected: false,
        }));
        if (!denied) retry();
      }
    }
    const offline = () => {
      setView((v) => ({ ...v, connected: false }));
      if (socket) reconnectSocket(socket);
    };
    window.addEventListener("offline", offline);
    void connect();
    return () => {
      stopped = true;
      controller.abort();
      clearTimeout(timer);
      clearWatchdog();
      socket?.close();
      window.removeEventListener("offline", offline);
    };
  }, [id, session, user?.id, restart]);
  return {
    ...(view.id === id ? view : { id, data: undefined, error: undefined, connected: false }),
    reload: () => setRestart((n) => n + 1),
  };
}
