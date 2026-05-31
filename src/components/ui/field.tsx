import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--foreground)]">
      <span className="text-[0.78rem] uppercase text-[var(--muted-foreground)]">{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-[var(--muted-foreground)]">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card-raised)] px-3 text-sm text-[var(--foreground)] shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] transition-all duration-500 ease-[var(--ease-press)] placeholder:text-[var(--muted-foreground)] hover:border-[var(--border-strong)] focus:border-[var(--accent)]";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("surface-shell", className)}>
      <div className="surface-core h-full" {...props} />
    </div>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-xs)] border border-[color-mix(in_srgb,var(--border)_80%,transparent)] bg-[color-mix(in_srgb,var(--muted)_72%,var(--card))] px-2.5 py-1 text-xs font-semibold text-[var(--muted-foreground)]",
        className
      )}
      {...props}
    />
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--muted)_42%,transparent)] p-6 text-center">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mx-auto max-w-md text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      {action ? <div className="mt-1 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-[var(--radius-sm)] bg-[linear-gradient(90deg,color-mix(in_srgb,var(--muted)_76%,transparent),color-mix(in_srgb,var(--card-raised)_88%,transparent),color-mix(in_srgb,var(--muted)_76%,transparent))] bg-[length:200%_100%]",
        className
      )}
    />
  );
}
