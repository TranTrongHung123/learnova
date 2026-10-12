import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { NavigationFeedback } from "./loading-feedback";

type Variant = "primary" | "secondary" | "ghost" | "tinted";

const styles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary shadow-sm hover:bg-primary-hover",
  secondary: "border border-control-border bg-surface hover:bg-muted",
  ghost: "hover:bg-muted text-muted-foreground",
  tinted: "border border-primary/20 bg-muted text-primary hover:bg-primary/10",
};

function classes(variant: Variant, className = "") {
  return `inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm leading-5 font-semibold [overflow-wrap:anywhere] [&>svg]:shrink-0 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;
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
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return (
    <Link className={`relative ${classes(variant, className)}`} {...props}>
      {children}
      <NavigationFeedback />
    </Link>
  );
}
