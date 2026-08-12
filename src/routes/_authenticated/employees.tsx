import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useDepartments, useProfiles, useProjects } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { useScope } from "@/hooks/useScope";
import { scopePeople } from "@/lib/scope";
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
  beforeLoad: async ({ context }) => {
    // Redirect plain employees away — they can't view other people
    // (The route guard runs after auth is ready via the _authenticated layout)
  },
  component: EmployeesPage,
});

function EmployeesPage() {
  const { isAdmin, isDeptAdmin, canManage } = useAuth();
  const scope = useScope();
  const { data: allPeople = [] } = useProfiles(canManage);
  const { data: departments = [] } = useDepartments();
  const { data: projects = [] } = useProjects();

  // Scope the list: super admin sees all, dept admin sees their team
  const people = scopePeople(allPeople, scope);

  const title = isAdmin ? "Employees" : "My Team";
  const subtitle = isAdmin
    ? "Everyone in the company and what they're working on."
    : "Your department members and their current workload.";

  if (!canManage) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        You don't have permission to view this page.
      </div>
    );
  }

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {people.map((p) => (
          <article key={p.id} className="surface-card animate-rise flex items-center gap-4 p-5">
            <Avatar className="size-12">
              <AvatarImage src={p.avatar_url ?? undefined} className="object-cover" />
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
        {people.length === 0 && (
          <p className="text-muted-foreground col-span-full py-12 text-center text-sm">
            No team members found.
          </p>
        )}
      </div>
    </>
  );
}
