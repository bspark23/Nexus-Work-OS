import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  useDepartments,
  useProfiles,
  useProjects,
  useReports,
  useTasks,
} from "@/hooks/useData";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: departments = [] } = useDepartments();
  const { data: people = [] } = useProfiles();
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: reports = [] } = useReports();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search employees, departments, projects, reports, tasks…" />
      <CommandList>
        <CommandEmpty>No matches found.</CommandEmpty>

        <CommandGroup heading="Projects">
          {projects.slice(0, 30).map((p) => (
            <CommandItem key={p.id} value={`project ${p.title}`} onSelect={() => go("/projects")}>
              {p.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Tasks">
          {tasks.slice(0, 30).map((t) => (
            <CommandItem key={t.id} value={`task ${t.title}`} onSelect={() => go("/tasks")}>
              {t.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Reports">
          {reports.slice(0, 30).map((r) => (
            <CommandItem
              key={r.id}
              value={`report ${r.title}`}
              onSelect={() => go(isAdmin ? "/company-reports" : "/reports")}
            >
              {r.title}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Employees">
          {people.slice(0, 30).map((p) => (
            <CommandItem
              key={p.id}
              value={`employee ${p.full_name} ${p.username}`}
              onSelect={() => go(isAdmin ? "/employees" : "/profile")}
            >
              {p.full_name}
              <span className="text-muted-foreground ml-auto text-xs">@{p.username}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Departments">
          {departments.map((d) => (
            <CommandItem
              key={d.id}
              value={`department ${d.name}`}
              onSelect={() => go(isAdmin ? "/departments" : "/dashboard")}
            >
              {d.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
