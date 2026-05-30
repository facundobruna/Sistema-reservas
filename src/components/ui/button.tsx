import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "icon" && "h-10 w-10 p-0",
        variant === "primary" && "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)] hover:brightness-95",
        variant === "secondary" && "border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "ghost" && "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "danger" && "border-transparent bg-[var(--danger)] text-white hover:brightness-95",
        className
      )}
      {...props}
    />
  );
}
