"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLinkStatus } from "next/link";

export function DelayedLoading({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    // Request nhanh không cần chớp loading; vùng chờ vẫn giữ kích thước.
    const timer = window.setTimeout(() => setVisible(true), 180);
    return () => window.clearTimeout(timer);
  }, []);
  return <div className={visible ? undefined : "invisible"}>{children}</div>;
}

export function NavigationFeedback() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="pointer-events-none absolute inset-x-2 bottom-0.5">
      <span className="sr-only">Đang chuyển trang</span>
      <DelayedLoading>
        <span aria-hidden="true" className="block h-0.5 rounded bg-primary" />
      </DelayedLoading>
    </span>
  );
}
