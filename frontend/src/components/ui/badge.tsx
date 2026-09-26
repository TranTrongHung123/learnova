import type { ReactNode } from "react";
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-muted px-2 py-1 text-xs font-semibold text-primary">
      {children}
    </span>
  );
}
