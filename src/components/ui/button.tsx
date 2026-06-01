import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "quiet";
  size?: "sm" | "md" | "icon";
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-medium transition-all duration-200 ease-[var(--ease-press)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "icon" && "h-10 w-10 p-0",
        variant === "primary" &&
          "border-transparent bg-[var(--foreground)] text-[var(--background)] shadow-[var(--shadow-soft)] hover:opacity-90",
        variant === "secondary" &&
          "border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:border-[var(--border-strong)] hover:bg-[var(--muted)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "quiet" &&
          "border-transparent bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--border)]",
        variant === "danger" &&
          "border-transparent bg-[var(--danger)] text-white shadow-[var(--shadow-soft)] hover:opacity-90",
        className
      )}
      {...props}
    />
  );
}
