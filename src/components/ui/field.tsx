import { cn } from "@/lib/cn";

type FieldProps = {
  label: string;
  children: React.ReactNode;
  hint?: string;
};

export function Field({ label, children, hint }: FieldProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--foreground)]">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-[var(--muted-foreground)]">{hint}</span> : null}
    </label>
  );
}

export const inputClassName =
  "min-h-11 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm text-[var(--foreground)] shadow-sm transition placeholder:text-[var(--muted-foreground)] focus:border-[var(--accent)]";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-lg border border-[var(--border)] bg-white shadow-sm", className)} {...props} />;
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--muted)] px-2 py-1 text-xs font-medium text-[var(--muted-foreground)]",
        className
      )}
      {...props}
    />
  );
}
