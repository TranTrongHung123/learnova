import type { InputHTMLAttributes } from "react";
export function Input({
  id,
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
}) {
  const description = [
    hint && `${id}-hint`,
    error && `${id}-error`,
    props["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold" htmlFor={id}>
        {label}
        {props.required && " (bắt buộc)"}
      </label>
      <input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={description || undefined}
        className={`min-h-11 w-full rounded-lg border bg-surface px-3 py-2 ${error ? "border-danger" : "border-control-border"}`}
      />
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
