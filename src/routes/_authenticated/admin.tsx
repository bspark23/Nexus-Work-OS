import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Building2, FolderKanban, ShieldCheck, Users } from "lucide-react";
import { useDepartments, useProfiles, useProjects, useRoles } from "@/hooks/useData";
import { relativeTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin Panel — Nexus Work OS" },
      { name: "description", content: "Super admin control centre for the company workspace." },
      { property: "og:title", content: "Admin Panel — Nexus Work OS" },
      { property: "og:description", content: "Super admin control centre." },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { data: people = [] } = useProfiles();
  const { data: departments = [] } = useDepartments();
  const { data: projects = [] } = useProjects();
  const { data: roles = [] } = useRoles();

  const admins = roles.filter((r) => r.role === "super_admin").length;

  return (
    <>
      <PageHeader title="Admin panel" subtitle="Company-wide control and oversight." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Employees" value={people.length} icon={<Users className="size-5" />} />
        <StatCard label="Departments" value={departments.length} tone="info" icon={<Building2 className="size-5" />} />
        <StatCard label="Projects" value={projects.length} tone="success" icon={<FolderKanban className="size-5" />} />
        <StatCard label="Super admins" value={admins} tone="warning" icon={<ShieldCheck className="size-5" />} />
      </div>

      <section className="surface-card animate-rise">
        <header className="border-b px-5 py-4">
          <h2 className="font-semibold">Team presence</h2>
        </header>
        <ul className="divide-y">
          {people.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <span>{p.full_name}</span>
              <span className="text-muted-foreground text-xs">
                last seen {relativeTime(p.last_seen_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
