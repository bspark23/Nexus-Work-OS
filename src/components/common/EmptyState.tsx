import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-card animate-rise flex flex-col items-center justify-center gap-4 px-6 py-16 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="text-primary bg-primary/10 ring-primary/15 flex size-14 items-center justify-center rounded-2xl ring-8">
          {icon}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description ? (
          <p className="text-muted-foreground mx-auto max-w-md text-sm">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
