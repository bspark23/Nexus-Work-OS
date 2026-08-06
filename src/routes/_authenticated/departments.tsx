import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/PageHeader";
import { useDepartments, useProfiles, useProjects } from "@/hooks/useData";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — Nexus Work OS" },
      { name: "description", content: "Company departments with team size and project load." },
      { property: "og:title", content: "Departments — Nexus Work OS" },
      { property: "og:description", content: "Departments, team size and project load." },
    ],
  }),
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data: departments = [] } = useDepartments();
  const { data: people = [] } = useProfiles();
  const { data: projects = [] } = useProjects();

  return (
    <>
      <PageHeader title="Departments" subtitle="Every team in the company at a glance." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {departments.map((d) => (
          <article key={d.id} className="surface-card animate-rise space-y-2 p-5">
            <h2 className="font-semibold">{d.name}</h2>
            <p className="text-muted-foreground text-xs">{d.description ?? "—"}</p>
            <div className="text-muted-foreground flex gap-4 pt-2 text-xs">
              <span>{people.filter((p) => p.department_id === d.id).length} members</span>
              <span>{projects.filter((p) => p.department_id === d.id).length} projects</span>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
