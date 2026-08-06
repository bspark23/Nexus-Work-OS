import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "primary",
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "destructive" | "info";
  className?: string;
}) {
  const toneMap = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    warning: "text-warning bg-warning/12",
    destructive: "text-destructive bg-destructive/10",
    info: "text-info bg-info/10",
  } as const;

  return (
    <div
      className={cn(
        "surface-card animate-rise transition-smooth hover:shadow-lifted group relative overflow-hidden p-5 hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground truncate text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <p className="text-3xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "transition-smooth flex size-11 shrink-0 items-center justify-center rounded-xl group-hover:scale-110",
              toneMap[tone],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}
