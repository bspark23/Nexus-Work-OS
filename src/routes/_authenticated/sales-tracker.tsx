import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { useAuth } from "@/hooks/useAuth";
import { useMyDepartment, useProfiles } from "@/hooks/useData";
import { SalesIndividualTracker, type TrackerRow } from "@/components/sales/SalesIndividualTracker";
import { saveTask, logActivity } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { UserPicker } from "@/components/common/UserPicker";

export const Route = createFileRoute("/_authenticated/sales-tracker")({
  head: () => ({ meta: [{ title: "Sales Tracker — Nexus Work OS" }] }),
  component: SalesTrackerPage,
});

function SalesTrackerPage() {
  const { user, profile, isAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const { data: allProfiles = [] } = useProfiles(true);
  const qc = useQueryClient();

  // Only super admins and sales team members can access this page
  const canAccess = isAdmin || isSales;

  // Task assignment dialog state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRow, setAssignRow] = useState<{ row: TrackerRow; sheetName: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  if (!canAccess) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        This page is only available to the Sales department and Super Admins.
      </div>
    );
  }

  function openAssignTask(row: TrackerRow, _idx: number, sheetName: string) {
    setAssignRow({ row, sheetName });
    
    // Generate a smart task title from available data
    const possibleTitleFields = ['services', 'service', 'task', 'title', 'description', 'company_customer', 'customer', 'client', 'project'];
    const possibleClientFields = ['company_customer', 'customer', 'client', 'company', 'business'];
    
    let taskTitle = "";
    let clientName = "";
    
    // Find the best title field
    for (const field of possibleTitleFields) {
      const value = Object.keys(row).find(k => k.toLowerCase().includes(field.toLowerCase()));
      if (value && row[value]) {
        taskTitle = String(row[value]).trim();
        break;
      }
    }
    
    // Find client/customer name
    for (const field of possibleClientFields) {
      const value = Object.keys(row).find(k => k.toLowerCase().includes(field.toLowerCase()));
      if (value && row[value]) {
        clientName = String(row[value]).trim();
        break;
      }
    }
    
    // Create a meaningful title and description
    if (taskTitle && clientName) {
      setTaskTitle(`${taskTitle} — ${clientName}`);
    } else if (taskTitle) {
      setTaskTitle(taskTitle);
    } else if (clientName) {
      setTaskTitle(`Task for ${clientName}`);
    } else {
      setTaskTitle(`Task from ${sheetName}`);
    }
    
    // Build description from all available data
    const descLines: string[] = [];
    Object.entries(row).forEach(([key, value]) => {
      if (key !== '__assigned_to_id' && value && String(value).trim()) {
        const cleanKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        descLines.push(`${cleanKey}: ${value}`);
      }
    });
    setTaskDesc(descLines.join('\n'));
    
    // Try to find a deadline field
    const deadlineFields = ['delivery_date', 'due_date', 'deadline', 'completion_date', 'target_date'];
    let deadline = "";
    for (const field of deadlineFields) {
      const value = Object.keys(row).find(k => k.toLowerCase().includes(field.toLowerCase()));
      if (value && row[value]) {
        deadline = String(row[value]).trim();
        break;
      }
    }
    setTaskDeadline(deadline);
    setTaskPriority("medium");
    
    // Pre-select the assignee if one was chosen in the table
    setTaskAssigneeId(row.__assigned_to_id || null);
    
    setAssignOpen(true);
  }

  async function submitAssignTask() {
    if (!assignRow || !user || !taskAssigneeId) return;
    const { sheetName } = assignRow;
    
    const emp = allProfiles.find((p) => p.id === taskAssigneeId);
    if (!emp) {
      toast.error("Please select an employee to assign this task to");
      return;
    }
    
    setAssigning(true);
    try {
      const title = taskTitle || `Task from ${sheetName}`;
      const id = await saveTask({
        owner_id: emp.id,
        assigned_to: emp.id,
        assigned_by: user.id,
        department_id: emp.department_id,
        title,
        description: taskDesc || null,
        priority: taskPriority,
        status: "pending",
        due_date: taskDeadline || null,
        notes: `Assigned from Sales Tracker — ${sheetName}`,
        progress: 0,
      });
      await broadcast({
        userId: emp.id,
        departmentId: emp.department_id ?? null,
        title: "New task assigned to you",
        body: `"${title}" assigned from Sales Tracker`,
        actorId: user.id,
        type: "task",
      });
      await logActivity({
        actor_id: user.id,
        action: "assigned task from sales tracker",
        entity_type: "task",
        entity_id: id,
        department_id: emp.department_id ?? null,
        description: `${profile?.full_name ?? "Sales"} assigned "${title}" to ${emp.full_name} from Sales Tracker`,
      });
      toast.success(`Task assigned to ${emp.full_name}`);
      setAssignOpen(false);
      setAssignRow(null);
      qc.invalidateQueries({ queryKey: ["tasks"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign task");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Sales Tracker"
        subtitle="Shared across the whole sales team — any changes you save are visible to everyone."
      />

      {/* Shared tracker — all sales team members see the same data */}
      <SalesIndividualTracker
        readOnly={false}
        allEmployees={allProfiles}
        onAssignTask={openAssignTask}
        userId={user?.id}
      />

      {/* Assign Task Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Send className="inline size-4 mr-2 text-primary" />
              Assign Task
              {taskAssigneeId && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  to {allProfiles.find(p => p.id === taskAssigneeId)?.full_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          {assignRow && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-xs space-y-1">
                <p><span className="font-medium">Sheet:</span> {assignRow.sheetName}</p>
                <p><span className="font-medium">Row Data:</span></p>
                <div className="max-h-32 overflow-y-auto text-[10px] space-y-0.5">
                  {Object.entries(assignRow.row)
                    .filter(([key, value]) => key !== '__assigned_to_id' && value && String(value).trim())
                    .slice(0, 8) // Show max 8 fields to avoid clutter
                    .map(([key, value]) => (
                      <div key={key} className="flex">
                        <span className="font-medium min-w-[60px] truncate">
                          {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                        </span>
                        <span className="ml-1 truncate">{String(value)}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Assign to *</Label>
                <UserPicker
                  people={allProfiles}
                  value={taskAssigneeId}
                  onChange={setTaskAssigneeId}
                  placeholder="Select employee to assign task to..."
                />
              </div>
              <div className="space-y-2">
                <Label>Task title *</Label>
                <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea rows={3} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={taskPriority} onValueChange={setTaskPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deadline</Label>
                  <Input type="date" value={taskDeadline} onChange={(e) => setTaskDeadline(e.target.value)} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={submitAssignTask} disabled={assigning || !taskTitle || !taskAssigneeId}>
              {assigning ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
