import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity as ActivityIcon,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListChecks,
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
import { useActivities, useProfiles, useProjects, useReports, useTasks } from "@/hooks/useData";
import { PROJECT_STATUSES, TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate, relativeTime } from "@/lib/format";

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

function Dashboard() {
  const { profile, isAdmin, user } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: reports = [] } = useReports();
  const { data: people = [] } = useProfiles();
  const { data: activities = [] } = useActivities();

  const myProjects = isAdmin ? projects : projects.filter((p) => p.owner_id === user?.id);
  const myTasks = isAdmin ? tasks : tasks.filter((t) => t.owner_id === user?.id);
  const myReports = isAdmin ? reports : reports.filter((r) => r.author_id === user?.id);

  const active = myProjects.filter((p) => p.status === "in_progress").length;
  const completed = myProjects.filter((p) => p.status === "completed").length;
  const blocked = myProjects.filter((p) => p.status === "blocked").length;
  const openTasks = myTasks.filter((t) => t.status !== "done").length;
  const avgProgress = myProjects.length
    ? Math.round(myProjects.reduce((s, p) => s + (p.progress ?? 0), 0) / myProjects.length)
    : 0;

  return (
    <>
      <PageHeader
        title={`Welcome back, ${profile?.full_name?.split(" ")[0] ?? "there"}`}
        subtitle={
          isAdmin
            ? "Company-wide overview of every team's work in real time."
            : "Here's where your work stands today."
        }
        actions={
          <>
            <Link to="/projects">
              <Button variant="outline">New project</Button>
            </Link>
            <Link to="/reports">
              <Button>Submit report</Button>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={isAdmin ? "Active projects" : "My active projects"}
          value={active}
          icon={<FolderKanban className="size-5" />}
          hint={`${myProjects.length} total`}
        />
        <StatCard
          label="Open tasks"
          value={openTasks}
          tone="info"
          icon={<ListChecks className="size-5" />}
          hint={`${myTasks.length} total tasks`}
        />
        <StatCard
          label="Completed"
          value={completed}
          tone="success"
          icon={<CheckCircle2 className="size-5" />}
          hint={`${avgProgress}% average progress`}
        />
        <StatCard
          label={isAdmin ? "Employees" : "Reports filed"}
          value={isAdmin ? people.length : myReports.length}
          tone={blocked ? "warning" : "primary"}
          icon={isAdmin ? <Users className="size-5" /> : <Clock className="size-5" />}
          hint={blocked ? `${blocked} blocked project(s)` : "All clear"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="surface-card animate-rise lg:col-span-2">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">{isAdmin ? "Latest projects" : "My projects"}</h2>
            <Link to="/projects" className="text-primary text-xs font-medium hover:underline">
              View all
            </Link>
          </header>
          {myProjects.length === 0 ? (
            <EmptyState
              className="border-0 bg-transparent shadow-none"
              icon={<FolderKanban className="size-6" />}
              title="No projects yet"
              description="Create your first project to start tracking work and progress."
              action={
                <Link to="/projects">
                  <Button>Create project</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y">
              {myProjects.slice(0, 6).map((p) => (
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
        </section>

        <section className="surface-card animate-rise">
          <header className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Live activity</h2>
            <ActivityIcon className="text-muted-foreground size-4" />
          </header>
          {activities.length === 0 ? (
            <p className="text-muted-foreground px-5 py-10 text-center text-xs">
              Activity will appear here as work happens.
            </p>
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
        </section>
      </div>

      <section className="surface-card animate-rise">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Tasks needing attention</h2>
          <Link to="/tasks" className="text-primary text-xs font-medium hover:underline">
            View all
          </Link>
        </header>
        {myTasks.filter((t) => t.status !== "done").length === 0 ? (
          <p className="text-muted-foreground px-5 py-10 text-center text-xs">
            Nothing outstanding — great work.
          </p>
        ) : (
          <ul className="divide-y">
            {myTasks
              .filter((t) => t.status !== "done")
              .slice(0, 6)
              .map((t) => (
                <li
                  key={t.id}
                  className="hover:bg-secondary/40 transition-smooth flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  {t.status === "blocked" ? (
                    <TriangleAlert className="text-destructive size-4 shrink-0" />
                  ) : (
                    <ListChecks className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                  <span className="text-muted-foreground text-xs">{formatDate(t.due_date)}</span>
                  <StatusBadge
                    label={labelOf(TASK_STATUSES, t.status)}
                    tone={toneOf(TASK_STATUSES, t.status)}
                  />
                </li>
              ))}
          </ul>
        )}
      </section>
    </>
  );
}
