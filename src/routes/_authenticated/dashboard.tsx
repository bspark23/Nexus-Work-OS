import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  AlarmClock,
  Briefcase,
  Building2,
  CheckCircle2,
  FileText,
  FolderKanban,
  ListChecks,
  Paperclip,
  TriangleAlert,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useScope } from "@/hooks/useScope";
import {
  useActivities,
  useAttachments,
  useCustomerJobs,
  useDepartments,
  useMyDepartment,
  useProfiles,
  useProjects,
  useReports,
  useTasks,
} from "@/hooks/useData";
import { PROJECT_STATUSES, TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";
import {
  isOverdue,
  scopeActivities,
  scopePeople,
  scopeProjects,
  scopeReports,
  scopeTasks,
} from "@/lib/scope";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Nexus Work OS" },
      { name: "description", content: "Your live work overview: projects, tasks and reports." },
      { property: "og:title", content: "Dashboard — Nexus Work OS" },
      { property: "og:description", content: "Live overview of projects, tasks and reports." },
    ],
  }),
  component: Dashboard,
});

function Panel({
  title,
  href,
  icon,
  children,
  className,
}: {
  title: string;
  href?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface-card animate-rise ${className ?? ""}`}>
      <header className="flex items-center justify-between border-b px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold">
          {icon}
          {title}
        </h2>
        {href ? (
          <Link to={href} className="text-primary text-xs font-medium hover:underline">
            View all
          </Link>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function Nothing({ text }: { text: string }) {
  return <p className="text-muted-foreground px-5 py-10 text-center text-xs">{text}</p>;
}

function TaskRow({ t }: { t: Task }) {
  return (
    <li className="hover:bg-secondary/40 transition-smooth flex flex-wrap items-center gap-3 px-5 py-3">
      {t.status === "blocked" ? (
        <TriangleAlert className="text-destructive size-4 shrink-0" />
      ) : isOverdue(t) ? (
        <AlarmClock className="text-warning size-4 shrink-0" />
      ) : (
        <ListChecks className="text-muted-foreground size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
      <span className="text-muted-foreground text-xs">{formatDate(t.due_date)}</span>
      <StatusBadge label={labelOf(TASK_STATUSES, t.status)} tone={toneOf(TASK_STATUSES, t.status)} />
    </li>
  );
}

function Dashboard() {
  const { profile, isAdmin, isDeptAdmin } = useAuth();
  const scope = useScope();
  const { department, isSales } = useMyDepartment();

  const { data: allProjects = [] } = useProjects();
  const { data: allTasks = [] } = useTasks();
  const { data: allReports = [] } = useReports();
  const { data: allPeople = [] } = useProfiles();
  const { data: allActivities = [] } = useActivities();
  const { data: departments = [] } = useDepartments();
  const { data: jobs = [] } = useCustomerJobs(true);
  const { data: files = [] } = useAttachments();

  const projects = scopeProjects(allProjects, scope);
  const tasks = scopeTasks(allTasks, scope);
  const reports = scopeReports(allReports, scope);
  const people = scopePeople(allPeople, scope);
  const activities = scopeActivities(allActivities, scope);

  const openTasks = tasks.filter((t) => t.status !== "done" && t.status !== "expired");
  const overdue = tasks.filter(isOverdue);
  const doneTasks = tasks.filter((t) => t.status === "done");
  const blockedTasks = tasks.filter((t) => t.status === "blocked");
  const completedProjects = projects.filter((p) => p.status === "completed").length;
  const activeProjects = projects.filter((p) => p.status === "in_progress").length;
  const avgProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.progress ?? 0), 0) / projects.length)
    : 0;

  const title = isAdmin
    ? "Company overview"
    : isDeptAdmin
      ? `${department?.name ?? "Department"} overview`
      : `Welcome back, ${profile?.full_name?.split(" ")[0] ?? "there"}`;

  const subtitle = isAdmin
    ? "Everything happening across every department, live."
    : isDeptAdmin
      ? "Your department's people, work and progress in real time."
      : "Your personal workspace — only your work lives here.";

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <>
            {isAdmin || isDeptAdmin ? (
              <Link to="/tasks">
                <Button variant="outline">Assign task</Button>
              </Link>
            ) : null}
            <Link to="/reports">
              <Button>Submit report</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isAdmin ? "Active projects" : isDeptAdmin ? "Department projects" : "My projects"}
          value={activeProjects}
          icon={<FolderKanban className="size-5" />}
          hint={`${projects.length} total · ${avgProgress}% avg progress`}
        />
        <StatCard
          label="Open tasks"
          value={openTasks.length}
          tone="info"
          icon={<ListChecks className="size-5" />}
          hint={`${doneTasks.length} completed`}
        />
        <StatCard
          label="Overdue"
          value={overdue.length}
          tone={overdue.length ? "warning" : "success"}
          icon={<AlarmClock className="size-5" />}
          hint={blockedTasks.length ? `${blockedTasks.length} blocked` : "Nothing past deadline"}
        />
        {isAdmin ? (
          <StatCard
            label="Employees"
            value={people.length}
            tone="success"
            icon={<Users className="size-5" />}
            hint={`${departments.length} departments`}
          />
        ) : isDeptAdmin ? (
          <StatCard
            label="Team members"
            value={people.length}
            tone="success"
            icon={<Users className="size-5" />}
            hint={`${reports.length} reports submitted`}
          />
        ) : (
          <StatCard
            label="Reports filed"
            value={reports.length}
            tone="success"
            icon={<CheckCircle2 className="size-5" />}
            hint={`${completedProjects} projects completed`}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          title={isAdmin ? "Latest projects" : isDeptAdmin ? "Department projects" : "My projects"}
          href="/projects"
          className="lg:col-span-2"
        >
          {projects.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              icon={<FolderKanban className="size-6" />}
              title="No projects yet"
              description="Projects you own or oversee will show up here."
              action={
                <Link to="/projects">
                  <Button>Create project</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y">
              {projects.slice(0, 6).map((p) => (
                <li key={p.id} className="hover:bg-secondary/40 transition-smooth px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.title}</p>
                      <p className="text-muted-foreground text-xs">
                        Due {formatDate(p.due_date)} · {p.project_type ?? "General"}
                      </p>
                    </div>
                    <StatusBadge
                      label={labelOf(PROJECT_STATUSES, p.status)}
                      tone={toneOf(PROJECT_STATUSES, p.status)}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <Progress value={p.progress ?? 0} className="h-1.5" />
                    <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                      {p.progress ?? 0}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={isAdmin || isDeptAdmin ? "Recent activity" : "My activity"}
          href="/activity"
          icon={<ActivityIcon className="text-muted-foreground size-4" />}
        >
          {activities.length === 0 ? (
            <Nothing text="Activity will appear here as work happens." />
          ) : (
            <ul className="divide-y">
              {activities.slice(0, 8).map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-sm">{a.description}</p>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">
                    {relativeTime(a.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={isAdmin || isDeptAdmin ? "Tasks needing attention" : "My tasks"} href="/tasks">
          {openTasks.length === 0 ? (
            <Nothing text="Nothing outstanding — great work." />
          ) : (
            <ul className="divide-y">
              {openTasks.slice(0, 7).map((t) => (
                <TaskRow key={t.id} t={t} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title={isAdmin ? "Company reports" : isDeptAdmin ? "Department reports" : "My reports"}
          href="/reports"
          icon={<FileText className="text-muted-foreground size-4" />}
        >
          {reports.length === 0 ? (
            <Nothing text="No reports submitted yet." />
          ) : (
            <ul className="divide-y">
              {reports.slice(0, 7).map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                  <span className="text-muted-foreground text-xs capitalize">{r.report_type}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(r.report_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {isAdmin || isDeptAdmin ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel
            title={isAdmin ? "Departments" : "My team"}
            href="/employees"
            icon={<Building2 className="text-muted-foreground size-4" />}
          >
            {isAdmin ? (
              <ul className="divide-y">
                {departments.map((d) => {
                  const staff = allPeople.filter((p) => p.department_id === d.id).length;
                  const load = allTasks.filter((t) => t.department_id === d.id).length;
                  return (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                      <span className="text-muted-foreground text-xs">{staff} people</span>
                      <span className="text-muted-foreground text-xs">{load} tasks</span>
                    </li>
                  );
                })}
              </ul>
            ) : people.length === 0 ? (
              <Nothing text="No one assigned to your department yet." />
            ) : (
              <ul className="divide-y">
                {people.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{p.full_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {allTasks.filter((t) => t.owner_id === p.id && t.status !== "done").length} open
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Customer jobs"
            href="/customer-jobs"
            icon={<Briefcase className="text-muted-foreground size-4" />}
          >
            {jobs.length === 0 ? (
              <Nothing text="No customer jobs received yet." />
            ) : (
              <ul className="divide-y">
                {jobs.slice(0, 6).map((j) => (
                  <li key={j.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{j.project_title}</span>
                    <span className="text-muted-foreground truncate text-xs">{j.customer_name}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      ) : (
        <Panel
          title="My files"
          icon={<Paperclip className="text-muted-foreground size-4" />}
        >
          {files.length === 0 ? (
            <Nothing text="Files you upload to projects, tasks and reports appear here." />
          ) : (
            <ul className="divide-y">
              {files.slice(0, 8).map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="min-w-0 flex-1 truncate hover:underline"
                  >
                    {f.file_name}
                  </a>
                  <span className="text-muted-foreground text-[11px]">
                    {relativeTime(f.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {/* Assigned Customer Jobs Panel for assigned employees & Super Admin */}
      {(() => {
        const assignedJobs = isAdmin
          ? jobs.filter((j) => !!j.assigned_employee_id)
          : jobs.filter((j) => j.assigned_employee_id === profile?.id);
        if (assignedJobs.length === 0 && !isAdmin) return null;
        return (
          <Panel
            title={isAdmin ? "Assigned Customer Jobs (Company-wide)" : "Customer Jobs Assigned to Me"}
            href="/customer-jobs"
            icon={<Briefcase className="text-muted-foreground size-4" />}
            className="mt-6"
          >
            {assignedJobs.length === 0 ? (
              <Nothing text="No customer jobs assigned yet." />
            ) : (
              <ul className="divide-y">
                {assignedJobs.slice(0, 6).map((j) => {
                  const assignedUser = allPeople.find((p) => p.id === j.assigned_employee_id);
                  return (
                    <li key={j.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{j.project_title}</p>
                        <p className="text-muted-foreground text-xs">Customer: {j.customer_name} {j.company_name ? `(${j.company_name})` : ""}</p>
                      </div>
                      {isAdmin && assignedUser && (
                        <StatusBadge label={`Assigned to: ${assignedUser.full_name}`} tone="info" />
                      )}
                      <StatusBadge label={labelOf(PROJECT_STATUSES, j.status)} tone={toneOf(PROJECT_STATUSES, j.status)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        );
      })()}
    </>
  );
}
