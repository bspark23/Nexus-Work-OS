import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ListChecks, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useTasks } from "@/hooks/useData";
import { deleteTask, saveTask, track } from "@/lib/api";
import { PRIORITIES, TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({
    meta: [
      { title: "Tasks — Nexus Work OS" },
      { name: "description", content: "Daily task tracking with priorities, status and due dates." },
      { property: "og:title", content: "Tasks — Nexus Work OS" },
      { property: "og:description", content: "Task tracking with priorities and due dates." },
    ],
  }),
  component: TasksPage,
});

const empty: Partial<Task> = { title: "", status: "pending", priority: "medium" };

function TasksPage() {
  const { user, profile, isAdmin } = useAuth();
  const { data: tasks = [] } = useTasks();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>(empty);

  async function submit() {
    if (!draft.title || !user) return;
    const id = await saveTask({ ...draft, owner_id: draft.owner_id ?? user.id });
    await track({
      actorId: user.id,
      actorName: profile?.full_name ?? "Someone",
      action: draft.id ? "updated a task" : "created a task",
      entityType: "task",
      entityId: id,
      detail: `${profile?.full_name ?? "Someone"} ${draft.id ? "updated" : "added"} task “${draft.title}”`,
    });
    toast.success("Task saved");
    setOpen(false);
    setDraft(empty);
    qc.invalidateQueries();
  }

  const columns = TASK_STATUSES.map((s) => ({
    ...s,
    items: tasks.filter((t) => t.status === s.value),
  }));

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={isAdmin ? "All tasks across the company." : "Your personal task board."}
        actions={
          <Button
            onClick={() => {
              setDraft(empty);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> New task
          </Button>
        }
      />

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="size-6" />}
          title="No tasks yet"
          description="Add your first task to start planning your day."
          action={
            <Button
              onClick={() => {
                setDraft(empty);
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New task
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-4">
          {columns.map((c) => (
            <section key={c.value} className="surface-card animate-rise flex flex-col p-4">
              <header className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{c.label}</h2>
                <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[11px]">
                  {c.items.length}
                </span>
              </header>
              <ul className="space-y-2">
                {c.items.map((t) => (
                  <li
                    key={t.id}
                    className="bg-secondary/50 hover:bg-secondary transition-smooth rounded-xl border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        className="min-w-0 flex-1 text-left text-sm font-medium"
                        onClick={() => {
                          setDraft(t);
                          setOpen(true);
                        }}
                      >
                        {t.title}
                      </button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={async () => {
                          await deleteTask(t.id);
                          qc.invalidateQueries();
                        }}
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <StatusBadge
                        label={labelOf(PRIORITIES, t.priority)}
                        tone={toneOf(PRIORITIES, t.priority)}
                      />
                      <span className="text-muted-foreground text-[11px]">
                        {formatDate(t.due_date)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Update task" : "New task"}</DialogTitle>
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
                <Label>Status</Label>
                <Select
                  value={draft.status ?? "pending"}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
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
              <Label>Due date</Label>
              <Input
                type="date"
                value={draft.due_date ?? ""}
                onChange={(e) => setDraft({ ...draft, due_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={draft.notes ?? ""}
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Save task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
