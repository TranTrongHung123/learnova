"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./input";

export function PasswordInput({
  visibilityLabel = "mật khẩu",
  ...props
}: Omit<ComponentProps<typeof Input>, "type" | "trailingAction"> & {
  visibilityLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailingAction={
        <button
          type="button"
          aria-label={`${visible ? "Ẩn" : "Hiện"} ${visibilityLabel}`}
          aria-controls={props.id}
          disabled={props.disabled}
          onClick={() => setVisible((value) => !value)}
          className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      }
    />
  );
}
