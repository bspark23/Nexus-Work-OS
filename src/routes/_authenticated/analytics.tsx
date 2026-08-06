import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Progress } from "@/components/ui/progress";
import { useDepartments, useProjects, useReports, useTasks } from "@/hooks/useData";
import { BarChart3, CheckCircle2, ListChecks, TriangleAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Nexus Work OS" },
      { name: "description", content: "Company performance analytics by department and status." },
      { property: "og:title", content: "Analytics — Nexus Work OS" },
      { property: "og:description", content: "Performance analytics by department." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: reports = [] } = useReports();
  const { data: departments = [] } = useDepartments();

  const completed = projects.filter((p) => p.status === "completed").length;
  const blocked = projects.filter((p) => p.status === "blocked").length;
  const rate = projects.length ? Math.round((completed / projects.length) * 100) : 0;

  return (
    <>
      <PageHeader title="Analytics" subtitle="How the company is performing right now." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completion rate" value={`${rate}%`} icon={<BarChart3 className="size-5" />} />
        <StatCard label="Completed projects" value={completed} tone="success" icon={<CheckCircle2 className="size-5" />} />
        <StatCard label="Blocked" value={blocked} tone="destructive" icon={<TriangleAlert className="size-5" />} />
        <StatCard label="Tasks & reports" value={`${tasks.length}/${reports.length}`} tone="info" icon={<ListChecks className="size-5" />} />
      </div>

      <section className="surface-card animate-rise p-5">
        <h2 className="mb-4 font-semibold">Department workload</h2>
        <ul className="space-y-4">
          {departments.map((d) => {
            const list = projects.filter((p) => p.department_id === d.id);
            const avg = list.length
              ? Math.round(list.reduce((s, p) => s + (p.progress ?? 0), 0) / list.length)
              : 0;
            return (
              <li key={d.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {list.length} projects · {avg}% avg progress
                  </span>
                </div>
                <Progress value={avg} className="h-2" />
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
