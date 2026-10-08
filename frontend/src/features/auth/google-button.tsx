"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./auth-provider";

export function GoogleButton() {
  const { session } = useAuth();
  const [state, setState] = useState<"loading" | "enabled" | "disabled" | "error">("loading");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    session
      .googleConfig(controller.signal)
      .then(({ enabled }) => setState(enabled ? "enabled" : "disabled"))
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [session, retry]);
  return (
    <div className="mt-5 space-y-2">
      <Button
        className="w-full"
        variant="secondary"
        disabled={state !== "enabled"}
        onClick={() => window.location.assign(session.googleUrl)}
      >
        Tiếp tục với Google
      </Button>
      {state === "loading" && (
        <p role="status" className="text-sm text-muted-foreground">
          Đang kiểm tra Google Login…
        </p>
      )}
      {state === "disabled" && (
        <p className="text-sm text-muted-foreground">Đăng nhập Google chưa được cấu hình.</p>
      )}
      {state === "error" && (
        <div role="status" className="text-sm text-muted-foreground">
          Chưa thể kiểm tra kết nối Google.
          <Button variant="ghost" onClick={() => setRetry(retry + 1)}>
            Thử lại
          </Button>
        </div>
      )}
    </div>
  );
}
