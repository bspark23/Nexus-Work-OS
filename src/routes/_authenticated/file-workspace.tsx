import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  FileSpreadsheet, Upload, Trash2, Plus, Save, Loader2,
  FileText, Download, Table2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/common/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { useMyDepartment, useSavedFile } from "@/hooks/useData";
import {
  upsertSavedFile, updateSavedFileRows, deleteSavedFile,
  type SavedFileRow,
} from "@/lib/jobs-api";
import { parseJobFile } from "@/lib/job-parse";

export const Route = createFileRoute("/_authenticated/file-workspace")({
  head: () => ({
    meta: [{ title: "File Workspace — Nexus Work OS" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    fromJob: s["fromJob"] as string | undefined,
  }),
  component: FileWorkspacePage,
});

function FileWorkspacePage() {
  const { user, isAdmin, isDeptAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: savedFile, isLoading } = useSavedFile(user?.id ?? null);

  // Access guard — only Sales, Dept Admins, Super Admins
  const canAccess = isAdmin || isDeptAdmin || isSales;
  if (!isLoading && !canAccess) {
    return (
      <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 text-sm">
        <FileSpreadsheet className="size-8 opacity-30" />
        <p>This page is only available to Sales department employees and admins.</p>
      </div>
    );
  }

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Local editable rows (initialised from savedFile when it loads)
  const [editRows, setEditRows] = useState<SavedFileRow[] | null>(null);
  const [dirty, setDirty] = useState(false);

  // The rows we're currently showing — prefer local edits, fall back to saved
  const displayRows = editRows ?? savedFile?.rows ?? [];
  const columns = savedFile?.columns ?? (displayRows[0] ? Object.keys(displayRows[0]) : []);
  const isPdf = savedFile?.file_type === "pdf";

  /* ─── Upload new file ─── */
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
      });

      setEditRows(null);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["saved_file", user.id] });
      toast.success(`"${files[0].name}" uploaded and saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setUploading(false);
    }
  }

  /* ─── Edit a cell ─── */
  function editCell(rowIdx: number, col: string, value: string) {
    const base = editRows ?? savedFile?.rows ?? [];
    const next = base.map((row, i) =>
      i === rowIdx ? { ...row, [col]: value } : row,
    );
    setEditRows(next);
    setDirty(true);
  }

  /* ─── Add a new row ─── */
  function addRow() {
    const base = editRows ?? savedFile?.rows ?? [];
    const blank = Object.fromEntries(columns.map((c) => [c, ""]));
    setEditRows([...base, blank]);
    setDirty(true);
  }

  /* ─── Delete a row ─── */
  function deleteRow(idx: number) {
    const base = editRows ?? savedFile?.rows ?? [];
    setEditRows(base.filter((_, i) => i !== idx));
    setDirty(true);
  }

  /* ─── Save edits to Firestore ─── */
  async function saveEdits() {
    if (!user || !editRows) return;
    setSaving(true);
    try {
      await updateSavedFileRows(user.id, editRows);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["saved_file", user.id] });
      toast.success("File saved");
    } catch {
      toast.error("Could not save — check your connection");
    } finally {
      setSaving(false);
    }
  }

  /* ─── Delete saved file ─── */
  async function handleDelete() {
    if (!user || !confirm("Delete the saved file? This cannot be undone.")) return;
    await deleteSavedFile(user.id);
    setEditRows(null);
    setDirty(false);
    qc.invalidateQueries({ queryKey: ["saved_file", user.id] });
    toast.success("File deleted");
  }

  /* ─── Export current table as CSV ─── */
  function exportCsv() {
    if (!displayRows.length) return;
    const header = columns.join(",");
    const body = displayRows
      .map((row) => columns.map((c) => `"${(row[c] ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = savedFile?.file_name.replace(/\.(xlsx|xls)$/, ".csv") ?? "export.csv";
    a.click();
  }

  /* ─── Use current file to create a job ─── */
  function useForNewJob() {
    navigate({ to: "/customer-jobs", search: { fromFile: "1" } });
  }

  if (isLoading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="File Workspace"
        subtitle="Upload a spreadsheet or PDF, edit it directly, and reuse it for customer jobs."
        actions={
          <div className="flex flex-wrap gap-2">
            {savedFile && (
              <>
                {!isPdf && dirty && (
                  <Button onClick={saveEdits} disabled={saving} size="sm">
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save edits
                  </Button>
                )}
                {!isPdf && (
                  <Button variant="outline" size="sm" onClick={exportCsv}>
                    <Download className="size-4" /> Export CSV
                  </Button>
                )}
                <Button onClick={useForNewJob} size="sm" variant="default">
                  <Table2 className="size-4" /> Use for new job
                </Button>
              </>
            )}
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" disabled={uploading} asChild>
                <span>
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                  {savedFile ? "Replace file" : "Upload file"}
                </span>
              </Button>
              <input
                type="file"
                hidden
                accept=".xlsx,.xls,.csv,.pdf"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </label>
            {savedFile && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        }
      />

      {!savedFile ? (
        <EmptyState
          icon={<FileSpreadsheet className="size-8" />}
          title="No file saved yet"
          description="Upload an Excel (.xlsx), CSV, or PDF file. Spreadsheets will be editable directly in the app. You can reuse the file for multiple customer jobs without re-uploading."
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
        <div className="space-y-4">
          {/* File info bar */}
          <div className="surface-card flex flex-wrap items-center gap-3 px-5 py-3">
            {isPdf
              ? <FileText className="text-destructive size-5 shrink-0" />
              : <FileSpreadsheet className="text-success size-5 shrink-0" />
            }
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-sm">{savedFile.file_name}</p>
              <p className="text-muted-foreground text-xs">
                {isPdf
                  ? "PDF — read only"
                  : `${displayRows.length} rows · ${columns.length} columns · ${dirty ? "Unsaved changes" : "Saved"}`
                }
                {" · "}Last updated {new Date(savedFile.updated_at).toLocaleDateString()}
              </p>
            </div>
            {dirty && (
              <span className="text-warning text-xs font-medium">● Unsaved changes</span>
            )}
          </div>

          {/* PDF viewer */}
          {isPdf && (
            <div className="surface-card p-5">
              <h2 className="mb-3 font-semibold text-sm">Extracted text</h2>
              <pre className="text-muted-foreground whitespace-pre-wrap text-xs leading-relaxed max-h-[60vh] overflow-y-auto">
                {savedFile.text || "No text could be extracted from this PDF."}
              </pre>
            </div>
          )}

          {/* Spreadsheet editor */}
          {!isPdf && (
            <div className="surface-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-secondary/40">
                      <th className="text-muted-foreground w-10 px-3 py-2.5 text-left text-xs font-medium">#</th>
                      {columns.map((col) => (
                        <th key={col} className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                      <th className="w-10 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b hover:bg-secondary/30 group">
                        <td className="text-muted-foreground px-3 py-1.5 text-xs">{rowIdx + 1}</td>
                        {columns.map((col) => (
                          <td key={col} className="px-1.5 py-1">
                            <Input
                              value={row[col] ?? ""}
                              onChange={(e) => editCell(rowIdx, col, e.target.value)}
                              className="h-8 min-w-[120px] border-transparent bg-transparent px-2 text-xs hover:border-border focus:border-border focus:bg-background"
                            />
                          </td>
                        ))}
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer: add row + save */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <Button variant="outline" size="sm" onClick={addRow}>
                  <Plus className="size-4" /> Add row
                </Button>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <p className="text-muted-foreground text-xs">You have unsaved changes</p>
                  )}
                  <Button size="sm" onClick={saveEdits} disabled={!dirty || saving}>
                    {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tip */}
          <p className="text-muted-foreground text-xs px-1">
            💡 Tip: Edit the rows here and click <strong>Save</strong>, then click{" "}
            <strong>"Use for new job"</strong> to pre-fill a customer job form with the current data — no re-uploading needed.
          </p>
        </div>
      )}
    </>
  );
}
