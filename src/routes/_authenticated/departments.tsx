import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useDepartments, useProfiles, useProjects, useTasks, useRoles } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Nexus Work OS" },
      { name: "description", content: "Company departments with team size and project load." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { isAdmin } = useAuth();
  const { data: departments = [] } = useDepartments();
  const { data: people = [] } = useProfiles(isAdmin);
  const { data: projects = [] } = useProjects(isAdmin);
  const { data: tasks = [] } = useTasks(isAdmin);
  const { data: roles = [] } = useRoles(isAdmin);

  if (!isAdmin) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        Super Admin access required.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Every team in the company — manage them from the Admin Panel."
        actions={
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ShieldCheck className="size-4" /> Manage in Admin Panel
            </Button>
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {departments.map((d) => {
          const staff = people.filter((p) => p.department_id === d.id);
          const deptProjects = projects.filter((p) => p.department_id === d.id);
          const deptTasks = tasks.filter((t) => t.department_id === d.id);
          const openTasks = deptTasks.filter((t) => t.status !== "done" && t.status !== "expired");
          const adminUser = staff.find((s) => roles.find((r) => r.user_id === s.id && r.role === "admin"));
          const avgProgress = deptProjects.length
            ? Math.round(deptProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / deptProjects.length)
            : 0;

          return (
            <article key={d.id} className="surface-card animate-rise space-y-4 p-5">
              <div className="flex items-start gap-3">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{d.name}</h2>
                  <p className="text-muted-foreground text-xs">{d.description ?? "No description"}</p>
                </div>
              </div>

              {avgProgress > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Avg project progress</span>
                    <span className="font-medium">{avgProgress}%</span>
                  </div>
                  <Progress value={avgProgress} className="h-1.5" />
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-secondary/60 rounded-lg p-2">
                  <p className="text-lg font-bold">{staff.length}</p>
                  <p className="text-muted-foreground text-[10px]">Members</p>
                </div>
                <div className="bg-secondary/60 rounded-lg p-2">
                  <p className="text-lg font-bold">{deptProjects.length}</p>
                  <p className="text-muted-foreground text-[10px]">Projects</p>
                </div>
                <div className="bg-secondary/60 rounded-lg p-2">
                  <p className="text-lg font-bold">{openTasks.length}</p>
                  <p className="text-muted-foreground text-[10px]">Open tasks</p>
                </div>
              </div>

              {adminUser && (
                <p className="text-muted-foreground text-xs">
                  Admin: <span className="text-foreground font-medium">{adminUser.full_name}</span>
                </p>
              )}
            </article>
          );
        })}
        {departments.length === 0 && (
          <div className="text-muted-foreground col-span-full py-16 text-center text-sm">
            No departments yet.{" "}
            <Link to="/admin" className="text-primary underline">Create one in the Admin Panel</Link>.
          </div>
        )}
      </div>
    </>
  );
}
