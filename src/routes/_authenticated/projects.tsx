import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FolderKanban, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, useProfiles, useDepartments } from "@/hooks/useData";
import { deleteProject, saveProject, track } from "@/lib/api";
import { PRIORITIES, PROJECT_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/projects")({
  head: () => ({
    meta: [
      { title: "Projects — Nexus Work OS" },
      { name: "description", content: "Track company projects, progress, blockers and delivery." },
      { property: "og:title", content: "Projects — Nexus Work OS" },
      { property: "og:description", content: "Track projects, progress and blockers." },
    ],
  }),
  component: ProjectsPage,
});

const empty: Partial<Project> = {
  title: "",
  project_type: "",
  description: "",
  status: "not_started",
  priority: "medium",
  progress: 0,
};

function ProjectsPage() {
  const { user, profile, isAdmin, isDeptAdmin, canManage } = useAuth();
  const { data: projects = [] } = useProjects();
  const { data: allProfiles = [] } = useProfiles(canManage);
  const { data: departments = [] } = useDepartments();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState<Partial<Project>>(empty);

  const visible = projects.filter((p) => filter === "all" || p.status === filter);

  async function submit() {
    if (!draft.title || !user) return;
    try {
      const id = await saveProject({ ...draft, owner_id: draft.owner_id ?? user.id, department_id: draft.department_id ?? (isDeptAdmin ? profile?.department_id ?? null : null), });
      await track({
        actorId: user.id,
        actorName: profile?.full_name ?? "Someone",
        action: draft.id ? "updated a project" : "created a project",
        entityType: "project",
        entityId: id,
        detail: `${profile?.full_name ?? "Someone"} ${draft.id ? "updated" : "created"} project “${draft.title}”`,
      });
      toast.success(draft.id ? "Project updated" : "Project created");
      setOpen(false);
      setDraft(empty);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={isAdmin ? "Every project across the company." : isDeptAdmin ? "All projects in your department." : "Projects you own and deliver."}
        actions={
          <>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                setDraft(empty);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New project
            </Button>
          </>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="No projects here"
          description="Create a project to start tracking progress, blockers and delivery dates."
          action={
            <Button
              onClick={() => {
                setDraft(empty);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New project
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((p) => {
            const ownerName = canManage
              ? allProfiles.find((u) => u.id === p.owner_id)?.full_name
              : null;
            const deptName = canManage
              ? departments.find((d) => d.id === p.department_id)?.name
              : null;
            return (
            <article
              key={p.id}
              className="surface-card animate-rise transition-smooth hover:shadow-lifted flex flex-col gap-3 p-5 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold truncate">{p.title}</h2>
                  {(ownerName || deptName) && (
                    <p className="text-muted-foreground text-xs mt-0.5 flex flex-wrap gap-x-2">
                      {ownerName && <span>👤 {ownerName}</span>}
                      {deptName && <span>🏢 {deptName}</span>}
                      {p.project_type && <span>{p.project_type}</span>}
                    </p>
                  )}
                </div>
                <StatusBadge
                  label={labelOf(PROJECT_STATUSES, p.status)}
                  tone={toneOf(PROJECT_STATUSES, p.status)}
                />
              </div>
              {p.description ? (
                <p className="text-muted-foreground line-clamp-2 text-sm">{p.description}</p>
              ) : null}
              <div className="flex items-center gap-3">
                <Progress value={p.progress ?? 0} className="h-1.5" />
                <span className="text-muted-foreground text-xs tabular-nums">
                  {p.progress ?? 0}%
                </span>
              </div>
              <div className="text-muted-foreground flex items-center justify-between text-xs">
                <span>Due {formatDate(p.due_date)}</span>
                <StatusBadge
                  label={labelOf(PRIORITIES, p.priority)}
                  tone={toneOf(PRIORITIES, p.priority)}
                />
              </div>
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDraft(p);
                    setOpen(true);
                  }}
                >
                  Update
                </Button>
                {(isAdmin || p.owner_id === user?.id) && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={async () => {
                      await deleteProject(p.id);
                      toast.success("Project deleted");
                      qc.invalidateQueries();
                    }}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                )}
              </div>
            </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Update project" : "New project"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={draft.title ?? ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Input
                  value={draft.project_type ?? ""}
                  placeholder="Website, Campaign, Video…"
                  onChange={(e) => setDraft({ ...draft, project_type: e.target.value })}
                />
              </div>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={draft.department_id ?? ""}
                    onValueChange={(v) => setDraft({ ...draft, department_id: v || null })}
                  >
                    <SelectTrigger><SelectValue placeholder="Assign to department…" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No department</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={draft.due_date ?? ""}
                  onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={draft.status ?? "not_started"}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={draft.priority ?? "medium"}
                  onValueChange={(v) => setDraft({ ...draft, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Progress — {draft.progress ?? 0}%</Label>
              <Slider
                value={[draft.progress ?? 0]}
                max={100}
                step={5}
                onValueChange={([v]) => setDraft({ ...draft, progress: v ?? 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                rows={3}
                value={draft.description ?? ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Current task / challenges</Label>
              <Textarea
                rows={2}
                value={draft.challenges ?? ""}
                onChange={(e) => setDraft({ ...draft, challenges: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

