import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-hover",
  secondary: "border border-control-border bg-surface hover:bg-muted",
  ghost: "hover:bg-muted text-muted-foreground",
};

function classes(variant: Variant, className = "") {
  return `inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-center text-sm font-semibold [&>svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;
}

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={classes(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={classes(variant, className)} {...props} />;
}
