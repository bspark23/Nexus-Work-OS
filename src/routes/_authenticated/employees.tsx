import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDepartments, useProfiles, useProjects } from "@/hooks/useData";
import { initials, isOnline } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — Nexus Work OS" },
      { name: "description", content: "Company directory with department, role and live status." },
      { property: "og:title", content: "Employees — Nexus Work OS" },
      { property: "og:description", content: "Directory with departments and live status." },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const { data: people = [] } = useProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: projects = [] } = useProjects();

  return (
    <>
      <PageHeader title="Employees" subtitle="Everyone in the company and what they're working on." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <article key={p.id} className="surface-card animate-rise flex items-center gap-4 p-5">
            <Avatar className="size-12">
              <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                {initials(p.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.full_name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {p.job_title ?? "Team member"} ·{" "}
                {departments.find((d) => d.id === p.department_id)?.name ?? "Unassigned"}
              </p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {projects.filter((x) => x.owner_id === p.id).length} projects
              </p>
            </div>
            <span
              className={cn(
                "size-2.5 rounded-full",
                isOnline(p.last_seen_at) ? "bg-success" : "bg-muted-foreground/40",
              )}
              title={isOnline(p.last_seen_at) ? "Online" : "Offline"}
            />
          </article>
        ))}
      </div>
    </>
  );
}
