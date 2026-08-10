import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2, ShieldCheck, Users, FolderKanban, ListChecks,
  ChevronDown, ChevronUp, CheckCircle2, Clock, TriangleAlert, AlarmClock,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useDepartments, useProfiles, useProjects, useTasks, useRoles } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { PROJECT_STATUSES, TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/scope";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Nexus Work OS" },
      { name: "description", content: "Company departments with team size and project load." },
    ],
  }),
  component: DepartmentsPage,
});

type Tab = "members" | "projects" | "tasks" | null;

function DepartmentsPage() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: departments = [] } = useDepartments();
  const { data: people = [] } = useProfiles(isAdmin);
  const { data: projects = [] } = useProjects(isAdmin);
  const { data: tasks = [] } = useTasks(isAdmin);
  const { data: roles = [] } = useRoles(isAdmin);

  // Track which dept+tab is expanded
  const [expanded, setExpanded] = useState<{ deptId: string; tab: Tab } | null>(null);

  function toggleTab(deptId: string, tab: Tab) {
    if (expanded?.deptId === deptId && expanded.tab === tab) {
      setExpanded(null); // collapse
    } else {
      setExpanded({ deptId, tab });
    }
  }

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
        subtitle="Click Members, Projects, or Tasks to expand that department's details."
        actions={
          <Link to="/admin">
            <Button variant="outline" size="sm">
              <ShieldCheck className="size-4" /> Manage in Admin Panel
            </Button>
          </Link>
        }
      />
      <div className="space-y-4">
        {departments.map((d) => {
          const staff = people.filter((p) => p.department_id === d.id);
          const deptProjects = projects.filter((p) => p.department_id === d.id);
          const deptTasks = tasks.filter((t) => t.department_id === d.id);
          const openTasks = deptTasks.filter((t) => t.status !== "done" && t.status !== "expired");
          const adminUser = staff.find((s) => roles.find((r) => r.user_id === s.id && r.role === "admin"));
          const avgProgress = deptProjects.length
            ? Math.round(deptProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / deptProjects.length)
            : 0;

          const isExpandedMembers = expanded?.deptId === d.id && expanded.tab === "members";
          const isExpandedProjects = expanded?.deptId === d.id && expanded.tab === "projects";
          const isExpandedTasks = expanded?.deptId === d.id && expanded.tab === "tasks";

          return (
            <div key={d.id} className="surface-card animate-rise overflow-hidden">
              {/* Header row */}
              <div className="flex flex-wrap items-center gap-4 p-5">
                <div className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold">{d.name}</h2>
                  <p className="text-muted-foreground text-xs">
                    {d.description ?? "No description"}
                    {adminUser && <> · Admin: <span className="text-foreground font-medium">{adminUser.full_name}</span></>}
                  </p>
                </div>
                {avgProgress > 0 && (
                  <div className="flex items-center gap-2 min-w-[120px]">
                    <Progress value={avgProgress} className="h-1.5 flex-1" />
                    <span className="text-muted-foreground text-xs w-8 text-right">{avgProgress}%</span>
                  </div>
                )}
              </div>

              {/* Stat buttons */}
              <div className="grid grid-cols-3 divide-x border-t">
                {/* Members */}
                <button
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 ${isExpandedMembers ? "bg-primary/8 text-primary font-semibold" : "text-muted-foreground"}`}
                  onClick={() => toggleTab(d.id, "members")}
                >
                  <Users className="size-4 shrink-0" />
                  <span>{staff.length} Members</span>
                  {isExpandedMembers ? <ChevronUp className="size-3.5 ml-auto" /> : <ChevronDown className="size-3.5 ml-auto" />}
                </button>

                {/* Projects */}
                <button
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 ${isExpandedProjects ? "bg-primary/8 text-primary font-semibold" : "text-muted-foreground"}`}
                  onClick={() => toggleTab(d.id, "projects")}
                >
                  <FolderKanban className="size-4 shrink-0" />
                  <span>{deptProjects.length} Projects</span>
                  {isExpandedProjects ? <ChevronUp className="size-3.5 ml-auto" /> : <ChevronDown className="size-3.5 ml-auto" />}
                </button>

                {/* Tasks */}
                <button
                  className={`flex items-center justify-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-secondary/50 ${isExpandedTasks ? "bg-primary/8 text-primary font-semibold" : "text-muted-foreground"}`}
                  onClick={() => toggleTab(d.id, "tasks")}
                >
                  <ListChecks className="size-4 shrink-0" />
                  <span>{openTasks.length} Open tasks</span>
                  {isExpandedTasks ? <ChevronUp className="size-3.5 ml-auto" /> : <ChevronDown className="size-3.5 ml-auto" />}
                </button>
              </div>

              {/* Expanded: Members */}
              {isExpandedMembers && (
                <div className="border-t bg-secondary/20">
                  {staff.length === 0 ? (
                    <p className="text-muted-foreground px-5 py-6 text-center text-sm">No members in this department.</p>
                  ) : (
                    <ul className="divide-y">
                      {staff.map((p) => (
                        <li key={p.id} className="flex items-center justify-between px-5 py-3">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{p.full_name}</p>
                            <p className="text-muted-foreground text-xs">@{p.username} · {p.job_title ?? "Member"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {roles.find(r => r.user_id === p.id && r.role === "admin") && (
                              <StatusBadge label="Admin" tone="info" />
                            )}
                            {roles.find(r => r.user_id === p.id && r.role === "super_admin") && (
                              <StatusBadge label="Super Admin" tone="warning" />
                            )}
                            <span className={`size-2 rounded-full ${p.status === "suspended" ? "bg-destructive" : "bg-success"}`} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Expanded: Projects */}
              {isExpandedProjects && (
                <div className="border-t bg-secondary/20">
                  {deptProjects.length === 0 ? (
                    <p className="text-muted-foreground px-5 py-6 text-center text-sm">No projects for this department.</p>
                  ) : (
                    <ul className="divide-y">
                      {deptProjects.map((p) => (
                        <li key={p.id} className="px-5 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">{p.title}</p>
                              <p className="text-muted-foreground text-xs">
                                {people.find(u => u.id === p.owner_id)?.full_name ?? "Unknown"} · Due {formatDate(p.due_date)}
                              </p>
                            </div>
                            <StatusBadge label={labelOf(PROJECT_STATUSES, p.status)} tone={toneOf(PROJECT_STATUSES, p.status)} />
                          </div>
                          <div className="flex items-center gap-2">
                            <Progress value={p.progress ?? 0} className="h-1 flex-1" />
                            <span className="text-muted-foreground text-[11px] w-8 text-right">{p.progress ?? 0}%</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="border-t px-5 py-2">
                    <button
                      className="text-primary text-xs hover:underline"
                      onClick={() => navigate({ to: "/projects" })}
                    >
                      View all projects →
                    </button>
                  </div>
                </div>
              )}

              {/* Expanded: Tasks */}
              {isExpandedTasks && (
                <div className="border-t bg-secondary/20">
                  {openTasks.length === 0 ? (
                    <p className="text-muted-foreground px-5 py-6 text-center text-sm">No open tasks for this department.</p>
                  ) : (
                    <ul className="divide-y">
                      {openTasks.slice(0, 10).map((t) => {
                        const overdue = isOverdue(t);
                        const assignee = people.find(p => p.id === t.owner_id)?.full_name;
                        const statusIcon =
                          t.status === "done" ? <CheckCircle2 className="text-success size-4 shrink-0" /> :
                          t.status === "blocked" ? <TriangleAlert className="text-destructive size-4 shrink-0" /> :
                          overdue ? <AlarmClock className="text-warning size-4 shrink-0" /> :
                          t.status === "in_progress" ? <Clock className="text-info size-4 shrink-0" /> :
                          <ListChecks className="text-muted-foreground size-4 shrink-0" />;
                        return (
                          <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                            {statusIcon}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{t.title}</p>
                              <p className="text-muted-foreground text-xs">
                                {assignee ?? "Unassigned"}
                                {t.due_date && <> · Due {formatDate(t.due_date)}</>}
                                {overdue && <span className="text-warning ml-1">⚠ Overdue</span>}
                              </p>
                            </div>
                            <StatusBadge label={labelOf(TASK_STATUSES, t.status)} tone={toneOf(TASK_STATUSES, t.status)} />
                          </li>
                        );
                      })}
                      {openTasks.length > 10 && (
                        <li className="px-5 py-2 text-muted-foreground text-xs">
                          +{openTasks.length - 10} more tasks
                        </li>
                      )}
                    </ul>
                  )}
                  <div className="border-t px-5 py-2">
                    <button
                      className="text-primary text-xs hover:underline"
                      onClick={() => navigate({ to: "/tasks" })}
                    >
                      View all tasks →
                    </button>
                  </div>
                </div>
              )}
            </div>
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
