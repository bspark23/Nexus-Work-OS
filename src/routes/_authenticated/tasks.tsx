import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ListChecks, Plus, Trash2, User2, AlarmClock, TriangleAlert,
  CheckCircle2, Clock, Send, ThumbsUp, RefreshCw, ArrowRightLeft, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { UserPicker } from "@/components/common/UserPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useScope } from "@/hooks/useScope";
import { useTasks, useProfiles, useDepartments } from "@/hooks/useData";
import { deleteTask, saveTask, logActivity } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { scopeTasks } from "@/lib/scope";
import { PRIORITIES, TASK_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/scope";
import type { Task } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks  Nexus Work OS" }] }),
  component: TasksPage,
});

const emptyAdmin: Partial<Task> = {
  title: "", description: null, status: "pending", priority: "medium",
  department_id: null, assigned_to: null, start_date: null, due_date: null,
  expected_delivery_date: null, notes: null, progress: 0,
};

function statusIcon(status: string) {
  if (status === "done") return <CheckCircle2 className="text-success size-4 shrink-0" />;
  if (status === "blocked") return <TriangleAlert className="text-destructive size-4 shrink-0" />;
  if (status === "expired") return <AlarmClock className="text-warning size-4 shrink-0" />;
  if (status === "in_progress") return <Clock className="text-info size-4 shrink-0" />;
  return <ListChecks className="text-muted-foreground size-4 shrink-0" />;
}

function TasksPage() {
  const { user, profile, isAdmin, isDeptAdmin, canManage, departmentId } = useAuth();
  const scope = useScope();
  const qc = useQueryClient();

  const { data: allTasks = [] } = useTasks();
  const { data: allProfiles = [] } = useProfiles(canManage);
  const { data: departments = [] } = useDepartments();

  const [localOverrides, setLocalOverrides] = useState<Record<string, Partial<Task>>>({});
  const baseTasks = scopeTasks(allTasks, scope);
  const tasks = useMemo(() =>
    baseTasks.map((t) => localOverrides[t.id] ? { ...t, ...localOverrides[t.id] } : t),
    [baseTasks, localOverrides],
  );

  // Admin assign/edit dialog
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Task>>(emptyAdmin);

  // Reassign dialog
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTask, setReassignTask] = useState<Task | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [reassignDept, setReassignDept] = useState<string>("");

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTask, setTransferTask] = useState<Task | null>(null);
  const [transferToDept, setTransferToDept] = useState<string>("");

  // Employee submit-update dialog
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitDraft, setSubmitDraft] = useState<{
    id: string; status: string; progress: number; notes: string;
    completionNote: string; completedDate: string; deliveryLink: string; taskTitle: string;
    departmentId: string | null; assignedBy: string | null;
    reason: string;
  } | null>(null);

  // Admin review dialog (when viewing a submitted task)
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewTask, setReviewTask] = useState<Task | null>(null);

  const deptPeople = draft.department_id
    ? allProfiles.filter((p) => p.department_id === draft.department_id)
    : isDeptAdmin
      ? allProfiles.filter((p) => p.department_id === departmentId)
      : allProfiles;

  const [taskBusy, setTaskBusy] = useState(false);
  const [reassignBusy, setReassignBusy] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);

  async function submitAssign() {
    if (!draft.title || !user) return;
    if (!draft.assigned_to) { toast.error("Select an employee to assign this task to"); return; }
    setTaskBusy(true);
    try {
      const isEdit = !!draft.id;
      const taskData: Partial<Task> = {
        ...draft,
        owner_id: draft.assigned_to!,
        assigned_by: user.id,
        department_id: draft.department_id ?? departmentId ?? null,
        // Only reset progress/status for NEW tasks, not edits
        ...(isEdit ? {} : { progress: 0, status: "pending", review_status: null }),
      };
      const id = await saveTask(taskData);
      if (!isEdit) {
        await broadcast({
          userId: draft.assigned_to ?? null,
          departmentId: taskData.department_id ?? null,
          title: "New task assigned to you",
          body: `"${draft.title}" — due ${draft.due_date ?? "no deadline"}`,
          actorId: user.id, type: "task",
        });
        await logActivity({
          actor_id: user.id, action: "assigned task", entity_type: "task", entity_id: id,
          department_id: taskData.department_id ?? null,
          description: `${profile?.full_name ?? "Admin"} assigned "${draft.title}" to ${deptPeople.find(p => p.id === draft.assigned_to)?.full_name ?? "employee"}`,
        });
      } else {
        await logActivity({
          actor_id: user.id, action: "updated task", entity_type: "task", entity_id: id,
          department_id: taskData.department_id ?? null,
          description: `${profile?.full_name ?? "Admin"} updated "${draft.title}" — status: ${draft.status}`,
        });
      }
      toast.success(isEdit ? "Task updated" : "Task assigned");
      setOpen(false); setDraft(emptyAdmin);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save task"); }
    finally { setTaskBusy(false); }
  }

  async function submitEmployeeUpdate() {
    if (!submitDraft || !user) return;
    const { id, status, progress, notes, completionNote, completedDate, deliveryLink, taskTitle, departmentId: deptId, assignedBy, reason } = submitDraft;
    const needsReason = status === "blocked" || status === "in_progress";
    if (needsReason && !reason.trim()) {
      toast.error(`Please provide a reason for marking this task as "${status}"`);
      return;
    }
    const nowDone = status === "done";
    const finalProgress = nowDone ? 100 : progress;
    const fullNotes = [
      notes,
      completionNote ? `\n Completion note: ${completionNote}` : "",
      completedDate ? `\n Completed on: ${completedDate}` : "",
      deliveryLink ? `\n Delivery link: ${deliveryLink}` : "",
      reason ? `\n Reason: ${reason}` : "",
    ].filter(Boolean).join("").trim();

    // Optimistic update for instant UI feedback
    setLocalOverrides(prev => ({ ...prev, [id]: { status, progress: finalProgress, notes: fullNotes || null, ...(nowDone ? { completed_at: completedDate || new Date().toISOString() } : {}) } }));
    setSubmitOpen(false); setSubmitDraft(null);
    toast.success(nowDone ? "Task submitted for review ✓" : `Task updated to "${status}"`);

    setSubmitBusy(true);
    try {
      await saveTask({ id, status, progress: finalProgress, notes: fullNotes || null, review_status: nowDone ? "pending_review" : null, ...(nowDone ? { completed_at: completedDate || new Date().toISOString() } : {}) });
      if (nowDone && assignedBy) {
        await broadcast({ userId: assignedBy, departmentId: deptId ?? null, title: "Task completed — awaiting review", body: `"${taskTitle}" was completed. Please review and approve.`, actorId: user.id, type: "task" });
      }
      if (status === "blocked") {
        await broadcast({ departmentId: deptId ?? null, title: "Task blocked", body: `"${taskTitle}" is blocked: ${reason}`, actorId: user.id, type: "warning" });
      }
      await logActivity({ actor_id: user.id, action: `task ${status}`, entity_type: "task", entity_id: id, department_id: profile?.department_id ?? null, description: `${profile?.full_name ?? "Employee"} updated "${taskTitle}" to ${status}${reason ? ` — ${reason}` : ""}` });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setLocalOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      setLocalOverrides(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast.error("Could not update — please try again");
    } finally {
      setSubmitBusy(false);
    }
  }

  async function submitReassign() {
    if (!reassignTask || !reassignTo || !user) return;
    const newOwner = allProfiles.find(p => p.id === reassignTo);
    setReassignBusy(true);
    try {
      await saveTask({
        id: reassignTask.id,
        owner_id: reassignTo,
        assigned_to: reassignTo,
        assigned_by: user.id,
        department_id: reassignDept || reassignTask.department_id,
        status: "pending",
        progress: 0,
        review_status: null,
      });
      await broadcast({
        userId: reassignTo,
        departmentId: (reassignDept || reassignTask.department_id) ?? null,
        title: "Task reassigned to you",
        body: `"${reassignTask.title}" has been reassigned to you.`,
        actorId: user.id,
        type: "task",
      });
      await logActivity({
        actor_id: user.id,
        action: "reassigned task",
        entity_type: "task",
        entity_id: reassignTask.id,
        department_id: reassignDept || (reassignTask.department_id ?? null),
        description: `${profile?.full_name ?? "Admin"} reassigned "${reassignTask.title}" to ${newOwner?.full_name ?? "employee"}`,
      });
      toast.success(`Task reassigned to ${newOwner?.full_name ?? "employee"}`);
      setReassignOpen(false); setReassignTask(null); setReassignTo(""); setReassignDept("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not reassign"); }
    finally { setReassignBusy(false); }
  }

  async function submitTransfer() {
    if (!transferTask || !transferToDept || !user) return;
    setTransferBusy(true);
    try {
      await saveTask({
        id: transferTask.id,
        department_id: transferToDept,
        status: "pending",
        review_status: null,
      });
      await broadcast({
        departmentId: transferToDept,
        title: "Task transferred to your department",
        body: `"${transferTask.title}" has been transferred to your department.`,
        actorId: user.id,
        type: "task",
      });
      await logActivity({
        actor_id: user.id,
        action: "transferred task",
        entity_type: "task",
        entity_id: transferTask.id,
        department_id: transferToDept,
        description: `${profile?.full_name ?? "Admin"} transferred "${transferTask.title}" to ${departments.find(d => d.id === transferToDept)?.name ?? "department"}`,
      });
      toast.success(`Task transferred to ${departments.find(d => d.id === transferToDept)?.name}`);
      setTransferOpen(false); setTransferTask(null); setTransferToDept("");
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not transfer"); }
    finally { setTransferBusy(false); }
  }

  async function approveTask(t: Task) {
    if (!user) return;
    await saveTask({ id: t.id, review_status: "approved" });
    await broadcast({ userId: t.owner_id, departmentId: t.department_id ?? null, title: "Task approved — Great job!", body: `"${t.title}" has been reviewed and approved.`, actorId: user.id, type: "success" });
    await logActivity({ actor_id: user.id, action: "approved task", entity_type: "task", entity_id: t.id, department_id: t.department_id ?? null, description: `${profile?.full_name} approved task "${t.title}"` });
    toast.success("Task approved — employee notified");
    setReviewOpen(false); setReviewTask(null);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  async function rejectTask(t: Task, reason: string) {
    if (!user) return;
    await saveTask({ id: t.id, review_status: "needs_revision", notes: (t.notes ?? "") + `\n\n Revision requested: ${reason}` });
    await broadcast({ userId: t.owner_id, departmentId: t.department_id ?? null, title: "Task needs revision", body: `"${t.title}"  ${reason}`, actorId: user.id, type: "warning" });
    toast.info("Revision request sent to employee");
    setReviewOpen(false); setReviewTask(null);
    qc.invalidateQueries({ queryKey: ["tasks"] });
  }

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const assignee = allProfiles.find(p => p.id === t.owner_id)?.full_name?.toLowerCase();
        if (!matchesTitle && !matchesDesc && !assignee?.includes(q)) return false;
      }
      if (filterDept !== "all" && t.department_id !== filterDept) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      return true;
    });
  }, [tasks, searchTerm, filterDept, filterPriority, allProfiles]);

  const columns = TASK_STATUSES.map(s => ({ ...s, items: filteredTasks.filter(t => t.status === s.value) }));

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === "done").length;
  const pendingTasks = tasks.filter(t => t.status === "pending" || t.status === "in_progress").length;
  const blockedTasks = tasks.filter(t => t.status === "blocked").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks Workspace"
        subtitle={isAdmin ? "Overview and management of all tasks across departments." : isDeptAdmin ? "Department task management & oversight." : "Your assigned tasks & deliverables."}
        actions={canManage ? <Button onClick={() => { setDraft(emptyAdmin); setOpen(true); }} className="gap-2"><Plus className="size-4" /> Assign Task</Button> : null}
      />

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="surface-card p-4 rounded-xl border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Tasks</p>
            <p className="text-2xl font-bold mt-0.5">{totalTasks}</p>
          </div>
          <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
            <ListChecks className="size-5" />
          </div>
        </div>
        <div className="surface-card p-4 rounded-xl border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">In Progress / Pending</p>
            <p className="text-2xl font-bold text-info mt-0.5">{pendingTasks}</p>
          </div>
          <div className="size-10 rounded-lg bg-info/10 flex items-center justify-center text-info font-bold">
            <Clock className="size-5" />
          </div>
        </div>
        <div className="surface-card p-4 rounded-xl border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Completed</p>
            <p className="text-2xl font-bold text-success mt-0.5">{completedTasks}</p>
          </div>
          <div className="size-10 rounded-lg bg-success/10 flex items-center justify-center text-success font-bold">
            <CheckCircle2 className="size-5" />
          </div>
        </div>
        <div className="surface-card p-4 rounded-xl border flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Blocked</p>
            <p className="text-2xl font-bold text-destructive mt-0.5">{blockedTasks}</p>
          </div>
          <div className="size-10 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive font-bold">
            <TriangleAlert className="size-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="surface-card p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
          <Input
            placeholder="Search tasks, descriptions, employees…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="h-9 text-xs max-w-xs"
          />
          {isAdmin && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="h-9 text-xs w-[160px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-9 text-xs w-[130px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState icon={<ListChecks className="size-6" />} title="No tasks yet"
          description={canManage ? "Assign a task to an employee to get started." : "No tasks have been assigned to you yet."}
          action={canManage ? <Button onClick={() => { setDraft(emptyAdmin); setOpen(true); }}><Plus className="size-4" /> Assign task</Button> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {columns.map(c => (
            <section key={c.value} className="surface-card animate-rise flex flex-col p-3.5 rounded-xl border">
              <header className="mb-3 flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-1.5">
                  {statusIcon(c.value)}
                  <h2 className="text-xs font-semibold uppercase tracking-wider">{c.label}</h2>
                </div>
                <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">{c.items.length}</span>
              </header>
              <ul className="space-y-2.5">
                {c.items.map(t => {
                  const assigneeName = allProfiles.find(p => p.id === t.owner_id)?.full_name;
                  const assigner = allProfiles.find(p => p.id === t.assigned_by)?.full_name;
                  const overdue = isOverdue(t);
                  const isOwner = t.owner_id === user?.id;
                  const pendingReview = (t as any).review_status === "pending_review";
                  const approved = (t as any).review_status === "approved";
                  const needsRevision = (t as any).review_status === "needs_revision";

                  return (
                    <li key={t.id} className={`rounded-xl border p-3 text-sm transition-all ${overdue ? "border-warning/40 bg-warning/5" : pendingReview ? "border-info/40 bg-info/5" : "bg-secondary/50 hover:bg-secondary"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {statusIcon(t.status)}
                          <div className="min-w-0">
                            <p className="truncate font-medium leading-tight">{t.title}</p>
                            {t.description && <p className="text-muted-foreground line-clamp-2 mt-0.5 text-[11px]">{t.description}</p>}
                          </div>
                        </div>
                        {canManage && <Button size="icon" variant="ghost" className="size-6 shrink-0" onClick={async () => { await deleteTask(t.id); qc.invalidateQueries(); }}><Trash2 className="text-destructive size-3" /></Button>}
                      </div>

                      {assigneeName && (
                        <div className="text-muted-foreground mt-1.5 flex items-center gap-1 text-[11px]">
                          <User2 className="size-3" /> {assigneeName} {assigner && <span className="ml-1"> {assigner}</span>}
                        </div>
                      )}

                      {t.progress > 0 && <div className="mt-2"><Progress value={t.progress} className="h-1" /></div>}

                      {pendingReview && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-info font-medium"><Send className="size-3" /> Submitted for review</div>}
                      {approved && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-success font-medium"><ThumbsUp className="size-3" /> Approved</div>}
                      {needsRevision && <div className="mt-1.5 flex items-center gap-1 text-[11px] text-warning font-medium"><TriangleAlert className="size-3" /> Needs revision</div>}

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <StatusBadge label={labelOf(PRIORITIES, t.priority)} tone={toneOf(PRIORITIES, t.priority)} />
                        <span className={`text-[11px] ${overdue ? "text-warning font-medium" : "text-muted-foreground"}`}>{formatDate(t.due_date)}</span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-border/60 space-y-1.5">
                        {canManage ? (
                          <>
                            <div className="grid grid-cols-2 gap-1.5">
                              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 gap-1" onClick={() => { setDraft({ ...t }); setOpen(true); }}>
                                Edit
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-[11px] px-2 gap-1"
                                onClick={() => { setReassignTask(t as Task); setReassignDept(t.department_id ?? ""); setReassignTo(""); setReassignOpen(true); }}>
                                <RefreshCw className="size-3 shrink-0" /> Reassign
                              </Button>
                            </div>
                            <Button size="sm" variant="outline" className="h-7 w-full text-[11px] px-2 gap-1 justify-center"
                              onClick={() => { setTransferTask(t as Task); setTransferToDept(""); setTransferOpen(true); }}>
                              <ArrowRightLeft className="size-3 shrink-0" /> Transfer Department
                            </Button>
                            {pendingReview && (
                              <Button size="sm" className="h-7 w-full text-[11px] bg-info/20 text-info border-info/30 hover:bg-info/30" variant="outline"
                                onClick={() => { setReviewTask(t as any); setReviewOpen(true); }}>
                                <ThumbsUp className="size-3 shrink-0" /> Review submission
                              </Button>
                            )}
                          </>
                        ) : (
                          isOwner && !pendingReview && !approved && (
                            <Button size="sm" variant="outline" className="h-7 w-full text-xs"
                              onClick={() => {
                                setSubmitDraft({ id: t.id, status: t.status, progress: t.progress, notes: t.notes ?? "", completionNote: "", completedDate: new Date().toISOString().slice(0, 10), deliveryLink: "", taskTitle: t.title, departmentId: t.department_id ?? null, assignedBy: t.assigned_by ?? null, reason: "" });
                                setSubmitOpen(true);
                              }}>Update / Submit</Button>
                          )
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* Admin Assign/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>{draft.id ? "Edit Task" : "Assign New Task"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Task title *</Label><Input value={draft.title ?? ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={draft.description ?? ""} onChange={e => setDraft({ ...draft, description: e.target.value })} /></div>
            {isAdmin && (
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={draft.department_id ?? ""} onValueChange={v => setDraft({ ...draft, department_id: v || null, assigned_to: null })}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Assign to *</Label>
              <UserPicker people={deptPeople} value={draft.assigned_to ?? null} onChange={id => setDraft({ ...draft, assigned_to: id, owner_id: id ?? "" })} placeholder="Pick an employee" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Priority</Label>
                <Select value={draft.priority ?? "medium"} onValueChange={v => setDraft({ ...draft, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={draft.status ?? "pending"} onValueChange={v => setDraft({ ...draft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Start date</Label><Input type="date" value={draft.start_date ?? ""} onChange={e => setDraft({ ...draft, start_date: e.target.value || null })} /></div>
              <div className="space-y-2"><Label>Deadline</Label><Input type="date" value={draft.due_date ?? ""} onChange={e => setDraft({ ...draft, due_date: e.target.value || null })} /></div>
              <div className="space-y-2 sm:col-span-2"><Label>Expected delivery</Label><Input type="date" value={draft.expected_delivery_date ?? ""} onChange={e => setDraft({ ...draft, expected_delivery_date: e.target.value || null })} /></div>
            </div>
            <div className="space-y-2"><Label>Notes / Instructions</Label><Textarea rows={2} value={draft.notes ?? ""} onChange={e => setDraft({ ...draft, notes: e.target.value || null })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submitAssign} disabled={taskBusy || !draft.title || !draft.assigned_to}>
              {taskBusy && <Loader2 className="size-4 animate-spin" />}
              {draft.id ? "Save changes" : "Assign task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Submit/Update Dialog */}
      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>Update Task</DialogTitle></DialogHeader>
          {submitDraft && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm font-medium truncate">"{submitDraft.taskTitle}"</p>
              <div className="space-y-2">
                <Label>Status *</Label>
                <Select value={submitDraft.status} onValueChange={v => setSubmitDraft({ ...submitDraft, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TASK_STATUSES.filter(s => s.value !== "expired").map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {(submitDraft.status === "blocked" || submitDraft.status === "in_progress") && (
                <div className="space-y-2">
                  <Label className="text-destructive">Reason / Cause * <span className="text-muted-foreground font-normal text-xs">(required for {submitDraft.status})</span></Label>
                  <Textarea rows={3} value={submitDraft.reason} onChange={e => setSubmitDraft({ ...submitDraft, reason: e.target.value })} placeholder={submitDraft.status === "blocked" ? "What is blocking you? Be specific." : "What are you currently working on?"} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Progress  {submitDraft.progress}%</Label>
                <Slider value={[submitDraft.progress]} max={100} step={5} onValueChange={([v]) => setSubmitDraft({ ...submitDraft, progress: v ?? 0 })} />
              </div>
              <div className="space-y-2">
                <Label>Update note</Label>
                <Textarea rows={3} value={submitDraft.notes} onChange={e => setSubmitDraft({ ...submitDraft, notes: e.target.value })} placeholder="Describe what you did" />
              </div>
              {submitDraft.status === "done" && (
                <>
                  <div className="rounded-xl border border-success/30 bg-success/5 p-3 space-y-3">
                    <p className="text-success text-xs font-medium"> Marking as Done  fill in completion details</p>
                    <div className="space-y-2">
                      <Label>Completion note *</Label>
                      <Textarea rows={3} value={submitDraft.completionNote} onChange={e => setSubmitDraft({ ...submitDraft, completionNote: e.target.value })} placeholder="Describe what you completed and how" />
                    </div>
                    <div className="space-y-2">
                      <Label>Date completed</Label>
                      <Input type="date" value={submitDraft.completedDate} onChange={e => setSubmitDraft({ ...submitDraft, completedDate: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Delivery link <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Input value={submitDraft.deliveryLink} onChange={e => setSubmitDraft({ ...submitDraft, deliveryLink: e.target.value })} placeholder="https://github.com/... or Google Drive link" />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitOpen(false)}>Cancel</Button>
            <Button onClick={submitEmployeeUpdate} disabled={submitBusy}>
              {submitBusy && <Loader2 className="size-4 animate-spin" />}
              {submitDraft?.status === "done" ? <><Send className="size-4" /> Submit for review</> : "Save update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Review Dialog */}
      <ReviewDialog open={reviewOpen} task={reviewTask} onClose={() => { setReviewOpen(false); setReviewTask(null); }} onApprove={approveTask} onReject={rejectTask} />

      {/* Reassign Dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><RefreshCw className="inline size-4 mr-2" />Reassign Task</DialogTitle></DialogHeader>
          {reassignTask && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">"{reassignTask.title}"</p>
              {isAdmin && (
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={reassignDept} onValueChange={v => { setReassignDept(v); setReassignTo(""); }}>
                    <SelectTrigger><SelectValue placeholder="Same or different dept…" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>Reassign to *</Label>
                <UserPicker
                  people={allProfiles.filter(p => reassignDept ? p.department_id === reassignDept : (isDeptAdmin ? p.department_id === departmentId : true))}
                  value={reassignTo || null}
                  onChange={id => setReassignTo(id ?? "")}
                  placeholder="Select new assignee…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button>
            <Button onClick={submitReassign} disabled={reassignBusy || !reassignTo}>
              {reassignBusy && <Loader2 className="size-4 animate-spin" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer to Department Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle><ArrowRightLeft className="inline size-4 mr-2" />Transfer to Department</DialogTitle></DialogHeader>
          {transferTask && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-sm">"{transferTask.title}"</p>
              <p className="text-muted-foreground text-xs">The department admin of the target department will receive this task.</p>
              <div className="space-y-2">
                <Label>Transfer to *</Label>
                <Select value={transferToDept} onValueChange={setTransferToDept}>
                  <SelectTrigger><SelectValue placeholder="Select target department…" /></SelectTrigger>
                  <SelectContent>
                    {departments
                      .filter(d => d.id !== transferTask.department_id)
                      .map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={submitTransfer} disabled={transferBusy || !transferToDept}>
              {transferBusy && <Loader2 className="size-4 animate-spin" />}
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewDialog({ open, task, onClose, onApprove, onReject }: {
  open: boolean; task: Task | null;
  onClose: () => void;
  onApprove: (t: Task) => void;
  onReject: (t: Task, reason: string) => void;
}) {
  const [revisionNote, setRevisionNote] = useState("");
  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Review Task Submission</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <p className="font-semibold">{task.title}</p>
            <p className="text-muted-foreground text-xs mt-0.5">Submitted for your review</p>
          </div>
          {task.notes && (
            <div className="rounded-xl bg-secondary/50 p-3 text-sm whitespace-pre-wrap">{task.notes}</div>
          )}
          <div className="space-y-2">
            <Label>Revision note <span className="text-muted-foreground font-normal text-xs">(only needed if rejecting)</span></Label>
            <Textarea rows={3} value={revisionNote} onChange={e => setRevisionNote(e.target.value)} placeholder="Explain what needs to be revised" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="outline" className="border-warning/40 text-warning hover:bg-warning/10"
            disabled={!revisionNote.trim()} onClick={() => onReject(task, revisionNote)}>
            <TriangleAlert className="size-4" /> Request revision
          </Button>
          <Button className="bg-success hover:bg-success/80 text-success-foreground" onClick={() => onApprove(task)}>
            <ThumbsUp className="size-4" /> Approve  Great job!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
