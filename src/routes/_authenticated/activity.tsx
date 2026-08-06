import { createFileRoute } from "@tanstack/react-router";
import { Activity as ActivityIcon } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useActivities } from "@/hooks/useData";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({
    meta: [
      { title: "Activity — Nexus Work OS" },
      { name: "description", content: "Live company activity feed of work updates." },
      { property: "og:title", content: "Activity — Nexus Work OS" },
      { property: "og:description", content: "Live feed of company work updates." },
    ],
  }),
  component: ActivityPage,
});

function ActivityPage() {
  const { data: activities = [] } = useActivities();
  return (
    <>
      <PageHeader title="Activity" subtitle="Everything happening across your workspace." />
      {activities.length === 0 ? (
        <EmptyState
          icon={<ActivityIcon className="size-6" />}
          title="Nothing logged yet"
          description="Actions like project updates and report submissions appear here instantly."
        />
      ) : (
        <ul className="surface-card animate-rise divide-y">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="bg-primary mt-2 size-1.5 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{a.description}</p>
                <p className="text-muted-foreground text-[11px]">{relativeTime(a.created_at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
