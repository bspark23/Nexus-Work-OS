import { createFileRoute } from "@tanstack/react-router";
import { AlarmClock, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { useTasks } from "@/hooks/useData";
import { isOverdue } from "@/lib/scope";
import { TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/overdue")({
  head: () => ({
    meta: [
      { title: "Overdue Tasks — Nexus Work OS" },
      { name: "description", content: "All tasks that have missed their deadline." },
    ],
  }),
  component: OverduePage,
});

function OverduePage() {
  const { data: tasks = [] } = useTasks();
  const overdue = tasks.filter(isOverdue);

  return (
    <>
      <PageHeader
        title="Overdue Tasks"
        subtitle="Tasks that have passed their deadline and are not yet completed."
      />

      {overdue.length === 0 ? (
        <EmptyState
          icon={<AlarmClock className="size-6" />}
          title="No overdue tasks"
          description="Great work — nothing has missed a deadline."
        />
      ) : (
        <div className="surface-card animate-rise">
          <ul className="divide-y">
            {overdue.map((t) => (
              <li key={t.id} className="hover:bg-secondary/40 transition-smooth flex flex-wrap items-center gap-3 px-5 py-4">
                <TriangleAlert className="text-destructive size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.title}</p>
                  {t.description && (
                    <p className="text-muted-foreground line-clamp-1 text-xs">{t.description}</p>
                  )}
                </div>
                <span className="text-muted-foreground text-xs">Due {formatDate(t.due_date)}</span>
                <StatusBadge
                  label={labelOf(TASK_STATUSES, t.status)}
                  tone={toneOf(TASK_STATUSES, t.status)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
