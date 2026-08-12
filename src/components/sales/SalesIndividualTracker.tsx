import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileSpreadsheet, Upload, Download, Plus, Trash2, Settings2,
  Send, Loader2, Save, RefreshCw, FileX, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserPicker } from "@/components/common/UserPicker";
import { saveSharedTracker, type TrackerSheetData } from "@/lib/jobs-api";
import { useSharedTracker } from "@/hooks/useData";
import type { Profile } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

/**
 * A single tracker row. Keys are dynamic — whatever columns the uploaded file
 * had are stored here. The only reserved keys are the ones the "Assign Task"
 * feature needs.
 */
export type TrackerRow = Record<string, string> & {
  __assigned_to_id?: string; // employee uid (hidden — not shown as a column)
};

export type TrackerSheet = {
  id: string;
  name: string;
  /** Column headers in order, exactly as they came from the uploaded file */
  columns: string[];
  rows: TrackerRow[];
};

// ── Built-in sheets (empty at first, filled by upload or manual add) ───────

const ALL_MONTHS = [
  { id: "sheet1", name: "Sheet1" },
  { id: "jan",    name: "JANUARY SALES" },
  { id: "feb",    name: "FEBRUARY SALES" },
  { id: "mar",    name: "MARCH SALES" },
  { id: "apr",    name: "APRIL SALES" },
  { id: "may",    name: "MAY SALES" },
  { id: "jun",    name: "JUNE SALES" },
  { id: "jul",    name: "JULY SALES" },
  { id: "aug",    name: "AUGUST SALES" },
  { id: "sep",    name: "SEPTEMBER SALES" },
  { id: "oct",    name: "OCTOBER SALES" },
  { id: "nov",    name: "NOVEMBER SALES" },
  { id: "dec",    name: "DECEMBER SALES" },
  { id: "tshirts", name: "TSHIRTS PRODUCTION" },
];

const INITIAL_SHEETS: TrackerSheet[] = ALL_MONTHS.map((m) => ({
  ...m,
  columns: [],
  rows: [],
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * These column names, if present in the uploaded file, get the special
 * "Assigned to" UserPicker treatment. All other columns are plain text inputs.
 */
const ASSIGN_COL_ALIASES = [
  "assigned to", "assigned_to", "assignedto", "assigned", "employee",
];

function isAssignCol(col: string) {
  return ASSIGN_COL_ALIASES.includes(col.toLowerCase().trim());
}

function emptyRow(columns: string[]): TrackerRow {
  return Object.fromEntries(columns.map((c) => [c, ""])) as TrackerRow;
}

function mergeSheets(remote: TrackerSheetData[], _local: TrackerSheet[]): TrackerSheet[] {
  return remote.map((s) => ({
    id: s.id,
    name: s.name,
    columns: (s as unknown as TrackerSheet).columns ?? Object.keys((s.rows?.[0] ?? {})).filter(k => k !== "__assigned_to_id"),
    rows: (s.rows as TrackerRow[]) ?? [],
  }));
}

// ── Resizable column header ────────────────────────────────────────────────

function ResizableTh({
  colKey,
  width,
  onResize,
  children,
  className = "",
}: {
  colKey: string;
  width: number;
  onResize: (colKey: string, newWidth: number) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const startX = useRef(0);
  const startW = useRef(0);

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    startX.current = e.clientX;
    startW.current = width;

    function onMove(me: MouseEvent) {
      const delta = me.clientX - startX.current;
      onResize(colKey, Math.max(60, startW.current + delta));
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return (
    <th
      style={{ width, minWidth: width, maxWidth: width }}
      className={`relative border-r px-2 py-2 text-left select-none ${className}`}
    >
      <span className="truncate block pr-2">{children}</span>
      <div
        onMouseDown={onMouseDown}
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/50 active:bg-primary z-20"
        title="Drag to resize column"
      />
    </th>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function SalesIndividualTracker({
  readOnly = false,
  allEmployees = [],
  onAssignTask,
  userId,
}: {
  readOnly?: boolean;
  allEmployees?: Profile[];
  onAssignTask?: (row: TrackerRow, rowIdx: number, sheetName: string) => void;
  userId?: string;
}) {
  const qc = useQueryClient();
  const { data: remoteData, isLoading } = useSharedTracker(true);

  const [sheets, setSheets] = useState<TrackerSheet[]>(INITIAL_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState("sheet1");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column widths — keyed by `sheetId:colName`
  const [colWidths, setColWidths] = useState<Record<string, number>>({});

  const [newSheetName, setNewSheetName] = useState("");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [deleteSheetId, setDeleteSheetId] = useState<string | null>(null);
  const [clearTableOpen, setClearTableOpen] = useState(false);

  // Sync remote → local (only when not dirty)
  useEffect(() => {
    if (!remoteData || dirty) return;
    if (remoteData.sheets.length > 0) {
      setSheets(mergeSheets(remoteData.sheets, INITIAL_SHEETS));
    }
  }, [remoteData]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const activeRows = activeSheet?.rows ?? [];
  const activeCols = activeSheet?.columns ?? [];

  function colWidth(col: string) {
    return colWidths[`${activeSheetId}:${col}`] ?? Math.max(120, col.length * 9);
  }

  function setColWidth(col: string, w: number) {
    setColWidths((prev) => ({ ...prev, [`${activeSheetId}:${col}`]: w }));
  }

  // ── row mutations ──────────────────────────────────────────────────────

  function updateCell(rowIdx: number, col: string, value: string) {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        const rows = [...s.rows];
        rows[rowIdx] = { ...rows[rowIdx], [col]: value };
        return { ...s, rows };
      }),
    );
    setDirty(true);
  }

  function updateAssignedTo(rowIdx: number, col: string, empId: string | null) {
    if (readOnly) return;
    const emp = empId ? allEmployees.find((e) => e.id === empId) : null;
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        const rows = [...s.rows];
        rows[rowIdx] = {
          ...rows[rowIdx],
          [col]: emp?.full_name ?? "",
          __assigned_to_id: empId ?? "",
        };
        return { ...s, rows };
      }),
    );
    setDirty(true);
  }

  function addRow() {
    if (readOnly) return;
    if (activeCols.length === 0) {
      toast.error("Add some columns first by importing a file or uploading data");
      return;
    }
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId ? { ...s, rows: [...s.rows, emptyRow(s.columns)] } : s,
      ),
    );
    setDirty(true);
  }

  function deleteRow(idx: number) {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId ? { ...s, rows: s.rows.filter((_, i) => i !== idx) } : s,
      ),
    );
    setDirty(true);
  }

  // ── sheet mutations ────────────────────────────────────────────────────

  function addSheet() {
    const name = newSheetName.trim().toUpperCase();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setSheets((prev) => [...prev, { id, name, columns: [], rows: [] }]);
    setActiveSheetId(id);
    setNewSheetName("");
    setAddSheetOpen(false);
    setDirty(true);
  }

  function doDeleteSheet() {
    if (!deleteSheetId) return;
    setSheets((prev) => {
      const remaining = prev.filter((s) => s.id !== deleteSheetId);
      if (activeSheetId === deleteSheetId) {
        setActiveSheetId(remaining[0]?.id ?? INITIAL_SHEETS[0].id);
      }
      return remaining.length > 0 ? remaining : INITIAL_SHEETS;
    });
    setDeleteSheetId(null);
    setDirty(true);
  }

  function clearActiveSheet() {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) => s.id === activeSheetId ? { ...s, rows: [] } : s),
    );
    setClearTableOpen(false);
    setDirty(true);
    toast.success("All rows cleared");
  }

  // ── save to Firestore ──────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!userId) { toast.error("You must be signed in to save"); return; }
    setSaving(true);
    try {
      // Cast TrackerSheet → TrackerSheetData (rows are compatible)
      const payload = sheets.map((s) => ({
        id: s.id,
        name: s.name,
        columns: s.columns,
        rows: s.rows,
      })) as unknown as TrackerSheetData[];
      await saveSharedTracker(payload, userId);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["shared_tracker"] });
      toast.success("Saved — all team members can now see your changes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save tracker");
    } finally {
      setSaving(false);
    }
  }, [sheets, userId, qc]);

  // ── import ── (use the file's own columns exactly as-is) ──────────────

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error("No sheets found in the file");
      const ws = wb.Sheets[sheetName];

      // sheet_to_json with header:1 gives us raw arrays — first row = headers
      const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" });
      if (raw.length === 0) throw new Error("File appears to be empty");

      // First non-empty row is the header
      const headerRow = raw[0].map((h) => String(h ?? "").trim()).filter(Boolean);
      if (headerRow.length === 0) throw new Error("Could not detect column headers");

      // Remaining rows become data
      const dataRows: TrackerRow[] = raw.slice(1)
        .filter((r) => r.some((v) => String(v ?? "").trim() !== ""))
        .map((r) => {
          const row: TrackerRow = {};
          headerRow.forEach((h, i) => {
            row[h] = String(r[i] ?? "").trim();
          });
          row.__assigned_to_id = "";
          return row;
        });

      setSheets((prev) =>
        prev.map((s) =>
          s.id === activeSheetId ? { ...s, columns: headerRow, rows: dataRows } : s,
        ),
      );
      setDirty(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(`Imported ${dataRows.length} rows with ${headerRow.length} columns — click Save to share`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setImporting(false);
    }
  }

  // ── export CSV ────────────────────────────────────────────────────────

  function exportCsv() {
    if (!activeSheet || activeCols.length === 0) { toast.error("Nothing to export"); return; }
    const header = activeCols.join(",");
    const lines = activeRows.map((r) =>
      activeCols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeSheet.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    toast.success("Exported to CSV");
  }

  // ── export Excel ──────────────────────────────────────────────────────

  async function exportExcel() {
    if (!activeSheet || activeCols.length === 0) { toast.error("Nothing to export"); return; }
    try {
      const XLSX = await import("xlsx");
      const data = [
        activeCols,
        ...activeRows.map((r) => activeCols.map((c) => r[c] ?? "")),
      ];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = activeCols.map((_, ci) => ({
        wch: Math.max(...data.map((row) => String(row[ci] ?? "").length), 12),
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeSheet.name.slice(0, 31));
      XLSX.writeFile(wb, `${activeSheet.name.replace(/\s+/g, "_")}.xlsx`);
      toast.success("Exported to Excel");
    } catch {
      toast.error("Could not export to Excel");
    }
  }

  // ── render ─────────────────────────────────────────────────────────────

  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-xl border shadow-sm">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/30 px-5 py-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <FileSpreadsheet className="text-primary size-5 shrink-0" />
          <h2 className="font-semibold text-sm">Shared Sales Tracker</h2>
          {(isLoading || importing || saving) && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {!isLoading && remoteData && (
            <span className="text-[11px] text-muted-foreground">
              Last saved: {new Date(remoteData.updated_at).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}>
                {importing
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Upload className="size-3.5" />}
                Import Excel/CSV
              </Button>
              <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv"
                onChange={(e) => handleUpload(e.target.files)} />

              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={addRow}>
                <Plus className="size-3.5" /> Add Row
              </Button>

              {activeRows.length > 0 && (
                <Button variant="outline" size="sm"
                  className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setClearTableOpen(true)}>
                  <FileX className="size-3.5" /> Clear Table
                </Button>
              )}

              <Button size="sm" className="h-8 text-xs gap-1.5"
                onClick={handleSave} disabled={saving || !dirty}
                variant={dirty ? "default" : "outline"}>
                {saving
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <Save className="size-3.5" />}
                {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
              </Button>
            </>
          )}

          {readOnly && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => qc.invalidateQueries({ queryKey: ["shared_tracker"] })}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          )}

          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportCsv}>
            <Download className="size-3.5" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={exportExcel}>
            <Download className="size-3.5" /> Excel
          </Button>
        </div>
      </div>

      {/* Unsaved banner */}
      {dirty && !readOnly && (
        <div className="bg-warning/10 border-b border-warning/30 px-5 py-1.5 text-[11px] text-warning font-medium flex items-center gap-2">
          ● Unsaved changes — click "Save Changes" to share with the whole sales team
        </div>
      )}

      {/* ── Table ── */}
      <div className="max-h-[600px] overflow-auto border-b text-xs">
        {activeCols.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            {isLoading || importing ? (
              <>
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="text-sm">{importing ? "Parsing your file…" : "Loading shared tracker…"}</p>
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-10 opacity-30" />
                <p className="text-sm font-medium">No data yet</p>
                <p className="text-xs max-w-xs text-center">
                  Click "Import Excel/CSV" to load a file — columns will appear exactly as they are in your file.
                  Or click "Add Row" after importing to add new entries.
                </p>
                {!readOnly && (
                  <Button variant="outline" size="sm" className="gap-1.5 mt-1"
                    onClick={() => fileInputRef.current?.click()}>
                    <Upload className="size-3.5" /> Import your file
                  </Button>
                )}
              </>
            )}
          </div>
        ) : (
          <table className="border-collapse text-left"
            style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
            <thead>
              <tr className="bg-secondary/60 text-muted-foreground border-b font-semibold sticky top-0 z-10">
                {/* Row number */}
                <th style={{ width: 36, minWidth: 36 }}
                  className="border-r px-2 py-2 text-center select-none text-[11px]">#</th>

                {/* Dynamic columns — exactly as the file had them */}
                {activeCols.map((col) => (
                  <ResizableTh
                    key={col}
                    colKey={col}
                    width={colWidth(col)}
                    onResize={setColWidth}
                  >
                    {col}
                  </ResizableTh>
                ))}

                {/* Action column */}
                {!readOnly && (
                  <ResizableTh colKey="__action" width={colWidth("__action") > 0 ? colWidth("__action") : 160} onResize={setColWidth} className="text-center">
                    Action
                  </ResizableTh>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan={activeCols.length + 2}
                    className="py-12 text-center text-muted-foreground italic">
                    No rows yet — click "Add Row" to start entering data.
                  </td>
                </tr>
              ) : (
                activeRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                    <td style={{ width: 36 }}
                      className="border-r bg-secondary/10 text-[11px] text-muted-foreground text-center px-1 select-none">
                      {idx + 1}
                    </td>

                    {activeCols.map((col) => (
                      <td key={col} style={{ width: colWidth(col) }} className="border-r p-1">
                        {/* "Assigned to" columns get the employee picker */}
                        {!readOnly && isAssignCol(col) ? (
                          <UserPicker
                            people={allEmployees}
                            value={row.__assigned_to_id || null}
                            onChange={(empId) => updateAssignedTo(idx, col, empId)}
                            placeholder="Assign…"
                            compact
                          />
                        ) : readOnly && isAssignCol(col) ? (
                          <span className="px-1.5 text-xs">{row[col] || "—"}</span>
                        ) : (
                          <Input
                            value={row[col] ?? ""}
                            disabled={readOnly}
                            onChange={(e) => updateCell(idx, col, e.target.value)}
                            className={`h-7 text-xs border-0 focus-visible:ring-1 bg-transparent w-full ${
                              String(row[col] ?? "").toUpperCase().includes("REFUND")
                                ? "text-destructive font-bold" : ""
                            }`}
                          />
                        )}
                      </td>
                    ))}

                    {!readOnly && (
                      <td style={{ width: colWidth("__action") > 0 ? colWidth("__action") : 160 }}
                        className="p-1 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {/* Assign Task — only if an "assigned to" column exists and has a picked employee */}
                          {onAssignTask && activeCols.some(isAssignCol) && row.__assigned_to_id ? (
                            <Button size="sm" variant="default"
                              className="h-7 text-[11px] px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold whitespace-nowrap"
                              onClick={() => onAssignTask(row, idx, activeSheet?.name ?? "")}>
                              <Send className="size-3" /> Assign Task
                            </Button>
                          ) : onAssignTask && activeCols.some(isAssignCol) ? (
                            <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">
                              Pick employee first
                            </span>
                          ) : null}
                          <Button size="icon" variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => deleteRow(idx)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Sheet tabs ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto bg-secondary/30 px-2 py-1 border-t">
        {!readOnly && (
          <>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Add sheet"
              onClick={() => setAddSheetOpen(true)}>
              <Plus className="size-3.5" />
            </Button>
            <div className="h-4 w-px bg-border mx-1 shrink-0" />
          </>
        )}
        {sheets.map((s) => {
          const active = s.id === activeSheetId;
          return (
            <div key={s.id} className="relative flex items-center group/tab">
              <button
                onClick={() => setActiveSheetId(s.id)}
                className={`pl-3 pr-1 py-1 text-[11px] font-medium rounded-t whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                  active
                    ? "bg-background text-primary border-t-2 border-primary shadow-sm"
                    : "text-muted-foreground hover:bg-background/60"
                }`}
              >
                {s.name.replace(" SALES", "").replace(" PRODUCTION", " PROD")}
                {s.rows.length > 0 && (
                  <span className="bg-secondary text-[9px] px-1.5 py-0.5 rounded-full">
                    {s.rows.length}
                  </span>
                )}
              </button>
              {!readOnly && (
                <button
                  title={`Delete "${s.name}"`}
                  onClick={(e) => { e.stopPropagation(); setDeleteSheetId(s.id); }}
                  className="ml-0.5 mr-1 p-0.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover/tab:opacity-100 transition-opacity"
                >
                  <X className="size-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Dialogs ── */}

      {/* Add Sheet */}
      <Dialog open={addSheetOpen} onOpenChange={setAddSheetOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Add New Sheet</DialogTitle></DialogHeader>
          <Input value={newSheetName} onChange={(e) => setNewSheetName(e.target.value)}
            placeholder="e.g. SEPTEMBER SALES"
            onKeyDown={(e) => e.key === "Enter" && addSheet()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSheetOpen(false)}>Cancel</Button>
            <Button onClick={addSheet} disabled={!newSheetName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Sheet Confirm */}
      <Dialog open={!!deleteSheetId} onOpenChange={(o) => !o && setDeleteSheetId(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" /> Delete Sheet
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Delete <strong>"{sheets.find((s) => s.id === deleteSheetId)?.name}"</strong>?{" "}
            {(sheets.find((s) => s.id === deleteSheetId)?.rows.length ?? 0) > 0
              ? `All ${sheets.find((s) => s.id === deleteSheetId)?.rows.length} rows will be removed.`
              : "This sheet is empty."}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSheetId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={doDeleteSheet}>Delete Sheet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear Table Confirm */}
      <Dialog open={clearTableOpen} onOpenChange={setClearTableOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <FileX className="size-4" /> Clear All Rows
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm">
            Remove all <strong>{activeRows.length} rows</strong> from{" "}
            <strong>"{activeSheet?.name}"</strong>?
            The sheet tab stays but all data will be deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearTableOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={clearActiveSheet}>Clear All Rows</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
