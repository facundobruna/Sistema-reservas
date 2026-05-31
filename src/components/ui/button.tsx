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
        "group inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] border font-semibold transition-all duration-500 ease-[var(--ease-press)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "min-h-11 px-4 text-sm",
        size === "icon" && "h-10 w-10 p-0",
        variant === "primary" &&
          "border-transparent bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[0_10px_26px_color-mix(in_srgb,var(--accent)_26%,transparent)] hover:-translate-y-0.5 hover:shadow-[0_16px_34px_color-mix(in_srgb,var(--accent)_30%,transparent)]",
        variant === "secondary" &&
          "border-[color-mix(in_srgb,var(--border)_86%,white)] bg-[var(--card-raised)] text-[var(--foreground)] shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:border-[var(--border-strong)]",
        variant === "ghost" &&
          "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[color-mix(in_srgb,var(--muted)_72%,transparent)]",
        variant === "quiet" &&
          "border-transparent bg-[color-mix(in_srgb,var(--muted)_62%,transparent)] text-[var(--foreground)] hover:bg-[var(--muted)]",
        variant === "danger" &&
          "border-transparent bg-[var(--danger)] text-white shadow-[0_10px_26px_color-mix(in_srgb,var(--danger)_22%,transparent)] hover:-translate-y-0.5",
        className
      )}
      {...props}
    />
  );
}
