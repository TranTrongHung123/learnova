import type { InputHTMLAttributes, ReactNode } from "react";

export function Input({
  id,
  label,
  hint,
  error,
  trailingAction,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  trailingAction?: ReactNode;
}) {
  const description = [hint && `${id}-hint`, error && `${id}-error`, props["aria-describedby"]]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-sm font-semibold" htmlFor={id}>
        {label}
        {props.required && (
          <span aria-hidden="true" className="ml-1 text-danger">*</span>
        )}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={description || undefined}
          className={`min-h-12 w-full min-w-0 rounded-xl border bg-surface px-3 py-2 ${trailingAction ? "pr-14 [&::-ms-reveal]:hidden" : ""} ${error ? "border-danger" : "border-control-border"}`}
        />
        {trailingAction && (
          <div className="absolute inset-y-0 right-1 flex items-center">{trailingAction}</div>
        )}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
