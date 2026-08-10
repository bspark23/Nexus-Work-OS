import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileSpreadsheet, Upload, Trash2, Plus, Save, Loader2,
  FileText, Download, Table2, Users, User, Send,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useMyDepartment, useSavedFile, useAllSavedFiles, useProfiles } from "@/hooks/useData";
import {
  upsertSavedFile, updateSavedFileRows, deleteSavedFile,
  type SavedFile, type SavedFileRow,
} from "@/lib/jobs-api";
import { parseJobFile } from "@/lib/job-parse";
import { saveTask, logActivity } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { SalesIndividualTracker, type TrackerRow } from "@/components/sales/SalesIndividualTracker";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/file-workspace")({
  head: () => ({ meta: [{ title: "File Workspace — Nexus Work OS" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    fromJob: s["fromJob"] as string | undefined,
  }),
  component: FileWorkspacePage,
});

function FileWorkspacePage() {
  const { user, profile, isAdmin, isDeptAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // ── data ──────────────────────────────────────────────────────────────────
  const { data: myFile, isLoading: myLoading } = useSavedFile(user?.id ?? null);
  const { data: allFiles = [], isLoading: allLoading } = useAllSavedFiles(isAdmin || isDeptAdmin);
  const { data: allProfiles = [] } = useProfiles(true);

  // ── view state ────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<"workspace" | "tracker">("tracker");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editRows, setEditRows] = useState<SavedFileRow[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  // ── task assignment dialog state ──────────────────────────────────────────
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignRow, setAssignRow] = useState<{ row: TrackerRow; sheetName: string } | null>(null);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskDeadline, setTaskDeadline] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");
  const [assigning, setAssigning] = useState(false);

  // ── derived ───────────────────────────────────────────────────────────────
  const canAccess = isAdmin || isDeptAdmin || isSales;
  const isLoading = myLoading || allLoading;

  const activeFileData = selectedFileId
    ? (allFiles.find((f) => f.id === selectedFileId) ?? null)
    : (myFile ?? null);

  const displayRows = editRows ?? activeFileData?.rows ?? [];
  const columns = activeFileData?.columns ?? (displayRows[0] ? Object.keys(displayRows[0]) : []);
  const isPdf = activeFileData?.file_type === "pdf";
  const isOwner = activeFileData?.owner_id === user?.id;

  // All team files (excluding own)
  const sharedFiles = allFiles.filter((f) => f.owner_id !== user?.id);

  // ── loading / access guards ───────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 text-sm">
        <FileSpreadsheet className="size-8 opacity-30" />
        <p>This page is only available to Sales department employees and admins.</p>
      </div>
    );
  }

  // ── handlers ──────────────────────────────────────────────────────────────
  async function handleUpload(files: FileList | null) {
    if (!files?.[0] || !user) return;
    setUploading(true);
    try {
      const parsed = await parseJobFile(files[0]);
      const fileType = files[0].name.toLowerCase().endsWith(".pdf")
        ? "pdf"
        : files[0].name.toLowerCase().endsWith(".csv")
          ? "csv"
          : "xlsx";
      await upsertSavedFile(user.id, {
        file_name: files[0].name,
        file_type: fileType,
        columns: parsed.rows[0] ? Object.keys(parsed.rows[0]) : [],
        rows: parsed.rows as SavedFileRow[],
        text: parsed.text,
        owner_name: profile?.full_name ?? "",
      });
      setEditRows(null);
      setDirty(false);
      setSelectedFileId(null);
      qc.invalidateQueries({ queryKey: ["saved_file", user.id] });
      qc.invalidateQueries({ queryKey: ["saved_files_all"] });
      toast.success(`"${files[0].name}" saved to your workspace`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setUploading(false);
    }
  }

  function editCell(rowIdx: number, col: string, value: string) {
    if (!isOwner) return;
    const base = editRows ?? activeFileData?.rows ?? [];
    setEditRows(base.map((row, i) => (i === rowIdx ? { ...row, [col]: value } : row)));
    setDirty(true);
  }

  function addRow() {
    if (!isOwner) return;
    const base = editRows ?? activeFileData?.rows ?? [];
    const blank = Object.fromEntries(columns.map((c) => [c, ""]));
    setEditRows([...base, blank]);
    setDirty(true);
  }

  function deleteRow(idx: number) {
    if (!isOwner) return;
    const base = editRows ?? activeFileData?.rows ?? [];
    setEditRows(base.filter((_, i) => i !== idx));
    setDirty(true);
  }

  async function saveEdits() {
    if (!activeFileData || !isOwner) return;
    setSaving(true);
    try {
      await updateSavedFileRows(activeFileData.id, editRows ?? []);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["saved_file", user?.id] });
      qc.invalidateQueries({ queryKey: ["saved_files_all"] });
      toast.success("File saved");
    } catch {
      toast.error("Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: SavedFile) {
    if (!confirm(`Delete "${f.file_name}"?`)) return;
    await deleteSavedFile(f.id);
    setEditRows(null);
    setDirty(false);
    if (selectedFileId === f.id) setSelectedFileId(null);
    qc.invalidateQueries({ queryKey: ["saved_file", f.id] });
    qc.invalidateQueries({ queryKey: ["saved_files_all"] });
    toast.success("File deleted");
  }

  function exportCsv() {
    if (!displayRows.length) return;
    const header = columns.join(",");
    const body = displayRows
      .map((row) => columns.map((c) => `"${(row[c] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (activeFileData?.file_name ?? "export").replace(/\.(xlsx|xls)$/, ".csv");
    a.click();
  }

  function switchToFile(f: SavedFile) {
    setSelectedFileId(f.id === user?.id ? null : f.id);
    setEditRows(null);
    setDirty(false);
  }

  function useForNewJob() {
    if (!activeFileData) return;
    const rows = editRows ?? activeFileData.rows ?? [];
    if (rows.length > 0) {
      sessionStorage.setItem(
        "prefill_job_file",
        JSON.stringify({ file_name: activeFileData.file_name, rows, columns: activeFileData.columns }),
      );
      navigate({ to: "/customer-jobs", search: { fromFile: "1", fileId: undefined } });
    } else {
      toast.error("The file has no rows to use for pre-filling");
    }
  }

  function openAssignTask(row: TrackerRow, _idx: number, sheetName: string) {
    setAssignRow({ row, sheetName });
    setTaskTitle(`${row.services} — ${row.company_customer}`.trim());
    setTaskDesc(
      `Client: ${row.company_customer}\nServices: ${row.services}\nPhone: ${row.country_code}${row.phone}\nComment: ${row.comment}`.trim(),
    );
    setTaskDeadline(row.delivery_date || "");
    setTaskPriority("medium");
    setAssignOpen(true);
  }

  async function submitAssignTask() {
    if (!assignRow || !user) return;
    const { row, sheetName } = assignRow;
    // Match by ID first (stored by UserPicker), fallback to name match
    const emp =
      allProfiles.find((p) => p.id === row.assigned_to_id) ??
      allProfiles.find((p) => p.full_name === row.assigned_to);
    if (!emp) {
      toast.error("Could not find the assigned employee on the platform");
      return;
    }
    setAssigning(true);
    try {
      const title = taskTitle || `${row.services} — ${row.company_customer}`;
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

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <PageHeader
        title="File Workspace & Sales Tracker"
        subtitle="Manage sales customer files and access the interactive Sales Individual Tracker."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-secondary p-1 rounded-lg flex gap-1">
              <Button
                variant={viewMode === "tracker" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setViewMode("tracker")}
              >
                <FileSpreadsheet className="size-3.5 mr-1" /> Sales Tracker
              </Button>
              <Button
                variant={viewMode === "workspace" ? "default" : "ghost"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => setViewMode("workspace")}
              >
                <Table2 className="size-3.5 mr-1" /> Custom File Workspace
              </Button>
            </div>
            {viewMode === "workspace" && (
              <>
                {activeFileData && (
                  <>
                    {!isPdf && isOwner && dirty && (
                      <Button onClick={saveEdits} disabled={saving} size="sm">
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                        Save
                      </Button>
                    )}
                    {!isPdf && (
                      <Button variant="outline" size="sm" onClick={exportCsv}>
                        <Download className="size-4" /> Export CSV
                      </Button>
                    )}
                    <Button onClick={useForNewJob} size="sm">
                      <Table2 className="size-4" /> Use for new job
                    </Button>
                  </>
                )}
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" disabled={uploading} asChild>
                    <span>
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      {myFile ? "Replace my file" : "Upload file"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    hidden
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={(e) => handleUpload(e.target.files)}
                  />
                </label>
              </>
            )}
          </div>
        }
      />

      {/* ── Sales Tracker tab ── */}
      {viewMode === "tracker" ? (
        <div className="space-y-4">
      <SalesIndividualTracker
        readOnly={false}
        allEmployees={allProfiles}
        onAssignTask={openAssignTask}
        userId={user?.id}
      />
        </div>
      ) : (
        /* ── Custom File Workspace tab ── */
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left panel: file list */}
          <div className="space-y-3">
            <div className="surface-card overflow-hidden">
              <div className="border-b px-4 py-3 flex items-center gap-2">
                <User className="text-muted-foreground size-4" />
                <p className="text-sm font-semibold">My File</p>
              </div>
              {myFile ? (
                <button
                  className={`w-full text-left px-4 py-3 flex items-start gap-2 hover:bg-secondary/50 transition-colors ${!selectedFileId ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                  onClick={() => switchToFile(myFile)}
                >
                  {myFile.file_type === "pdf" ? (
                    <FileText className="text-destructive size-4 mt-0.5 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="text-success size-4 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{myFile.file_name}</p>
                    <p className="text-muted-foreground text-[11px]">
                      {new Date(myFile.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              ) : (
                <p className="text-muted-foreground px-4 py-6 text-center text-xs">No file uploaded yet</p>
              )}
            </div>

            {(isAdmin || isDeptAdmin) && (
              <div className="surface-card overflow-hidden">
                <div className="border-b px-4 py-3 flex items-center gap-2">
                  <Users className="text-muted-foreground size-4" />
                  <p className="text-sm font-semibold">All Team Files</p>
                  <span className="text-muted-foreground text-xs ml-auto">{sharedFiles.length}</span>
                </div>
                <div className="divide-y max-h-[400px] overflow-y-auto">
                  {sharedFiles.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-6 text-center text-xs">No files from team yet</p>
                  ) : (
                    sharedFiles.map((f) => (
                      <div
                        key={f.id}
                        className={`flex items-center gap-2 px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer ${selectedFileId === f.id ? "bg-primary/5 border-l-2 border-primary" : ""}`}
                        onClick={() => switchToFile(f)}
                      >
                        {f.file_type === "pdf" ? (
                          <FileText className="text-destructive size-3.5 shrink-0" />
                        ) : (
                          <FileSpreadsheet className="text-success size-3.5 shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{f.file_name}</p>
                          <p className="text-muted-foreground text-[11px]">{f.owner_name || "Unknown"}</p>
                        </div>
                        {(isAdmin || f.owner_id === user?.id) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6 shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleDelete(f); }}
                          >
                            <Trash2 className="text-destructive size-3" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right panel: viewer / editor */}
          <div>
            {!activeFileData ? (
              <EmptyState
                icon={<FileSpreadsheet className="size-8" />}
                title="Select or upload a file"
                description="Upload your Excel, CSV or PDF. Admins can see and use files uploaded by all team members."
                action={
                  <label className="cursor-pointer">
                    <Button disabled={uploading} asChild>
                      <span>
                        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                        Upload file
                      </span>
                    </Button>
                    <input
                      type="file"
                      hidden
                      accept=".xlsx,.xls,.csv,.pdf"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                  </label>
                }
              />
            ) : (
              <div className="space-y-3">
                <div className="surface-card flex flex-wrap items-center gap-3 px-5 py-3">
                  {isPdf ? (
                    <FileText className="text-destructive size-5 shrink-0" />
                  ) : (
                    <FileSpreadsheet className="text-success size-5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{activeFileData.file_name}</p>
                    <p className="text-muted-foreground text-xs">
                      {isPdf ? "PDF — read only" : `${displayRows.length} rows · ${columns.length} cols`}
                      {" · "}Uploaded by {activeFileData.owner_name || "you"}
                      {" · "}{new Date(activeFileData.updated_at).toLocaleDateString()}
                      {!isOwner && <span className="text-info ml-2">· Read-only (view only)</span>}
                    </p>
                  </div>
                  {dirty && isOwner && <span className="text-warning text-xs font-medium">● Unsaved</span>}
                </div>

                {isPdf && (
                  <div className="surface-card p-5">
                    <h2 className="mb-3 font-semibold text-sm">Extracted text</h2>
                    <pre className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed max-h-[60vh] overflow-y-auto">
                      {activeFileData.text || "No text extracted."}
                    </pre>
                  </div>
                )}

                {!isPdf && (
                  <div className="surface-card overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-secondary/40">
                            <th className="text-muted-foreground w-10 px-3 py-2.5 text-left text-xs">#</th>
                            {columns.map((col) => (
                              <th key={col} className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                            {isOwner && <th className="w-10 px-3 py-2.5" />}
                          </tr>
                        </thead>
                        <tbody>
                          {displayRows.map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-b hover:bg-secondary/30 group">
                              <td className="text-muted-foreground px-3 py-1.5 text-xs">{rowIdx + 1}</td>
                              {columns.map((col) => (
                                <td key={col} className="px-1.5 py-1">
                                  {isOwner ? (
                                    <Input
                                      value={row[col] ?? ""}
                                      onChange={(e) => editCell(rowIdx, col, e.target.value)}
                                      className="h-8 min-w-[120px] border-transparent bg-transparent px-2 text-xs hover:border-border focus:border-border focus:bg-background"
                                    />
                                  ) : (
                                    <span className="px-2 text-xs">{row[col] ?? ""}</span>
                                  )}
                                </td>
                              ))}
                              {isOwner && (
                                <td className="px-2 py-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 opacity-0 group-hover:opacity-100"
                                    onClick={() => deleteRow(rowIdx)}
                                  >
                                    <Trash2 className="text-destructive size-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between border-t px-4 py-3">
                      {isOwner ? (
                        <>
                          <Button variant="outline" size="sm" onClick={addRow}>
                            <Plus className="size-4" /> Add row
                          </Button>
                          <Button size="sm" onClick={saveEdits} disabled={!dirty || saving}>
                            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                            Save
                          </Button>
                        </>
                      ) : (
                        <p className="text-muted-foreground text-xs">
                          You can view and use this file but only the owner can edit it.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <p className="text-muted-foreground text-xs px-1">
                  Click <strong>"Use for new job"</strong> to pre-fill a customer job form with this file's data.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Assign Task Dialog ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              <Send className="inline size-4 mr-2 text-primary" />
              Assign Task to{" "}
              {assignRow?.row.assigned_to ||
                allProfiles.find((p) => p.id === assignRow?.row.assigned_to_id)?.full_name ||
                "Employee"}
            </DialogTitle>
          </DialogHeader>
          {assignRow && (
            <div className="space-y-4">
              <div className="rounded-lg bg-secondary/50 p-3 text-xs space-y-1">
                <p><span className="font-medium">Client:</span> {assignRow.row.company_customer}</p>
                <p><span className="font-medium">Service:</span> {assignRow.row.services}</p>
                <p><span className="font-medium">Sheet:</span> {assignRow.sheetName}</p>
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
            <Button onClick={submitAssignTask} disabled={assigning || !taskTitle}>
              {assigning ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Assign Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
