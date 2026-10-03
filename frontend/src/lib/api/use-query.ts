"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/auth-provider";

export function useApiQuery<T>(path: string) {
  const { session } = useAuth();
  const [revision, setRevision] = useState(0);
  const key = `${path}:${revision}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  useEffect(() => {
    const controller = new AbortController();
    session.api.request<T>(path, { signal: controller.signal }).then(
      data => { if (!controller.signal.aborted) setResult({ key, data }); },
      error => { if (!controller.signal.aborted) setResult({ key, error }); },
    );
    return () => controller.abort();
  }, [session, path, key]);
  return { data: result.key === key ? result.data : undefined, error: result.key === key ? result.error : undefined, reload: () => setRevision(n => n + 1) };
}
