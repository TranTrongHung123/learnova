"use client";

import { useState } from "react";

export function Avatar({ name, url, large = false }: { name: string; url?: string | null; large?: boolean }) {
  const [failed, setFailed] = useState<string | null>(null);
  const safe = !!url && /^https:\/\//i.test(url) && url !== failed;
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-bold text-primary ${large ? "size-16 text-xl" : "size-9 text-sm"}`}>
      {safe && url ? (
        // URL do người dùng chọn chỉ tải ở browser; không đi qua image optimizer phía server.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" width={large ? 64 : 36} height={large ? 64 : 36} referrerPolicy="no-referrer"
          className="size-full object-cover" onError={() => setFailed(url)} />
      ) : Array.from(name.trim())[0]?.toLocaleUpperCase("vi") || "?"}
    </span>
  );
}
