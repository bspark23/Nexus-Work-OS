import { useState, useRef, useEffect, useCallback } from "react";
import {
  FileSpreadsheet, Upload, Download, Plus, Trash2,
  Send, Loader2, Save, RefreshCw, FileX, X,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UserPicker } from "@/components/common/UserPicker";
import { saveSharedTracker, type TrackerSheetData } from "@/lib/jobs-api";
import { useSharedTracker } from "@/hooks/useData";
import type { Profile } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type TrackerRow = Record<string, string> & {
  __assigned_to_id?: string;
};

export type TrackerSheet = {
  id: string;
  name: string;
  columns: string[];
  rows: TrackerRow[];
};

// ── Helpers ────────────────────────────────────────────────────────────────

const ASSIGN_COL_ALIASES = [
  "assigned to", "assigned_to", "assignedto", "assigned", "employee",
];

function isAssignCol(col: string) {
  return ASSIGN_COL_ALIASES.includes(col.toLowerCase().trim());
}

function emptyRow(columns: string[]): TrackerRow {
  return Object.fromEntries(columns.map((c) => [c, ""])) as TrackerRow;
}

function mergeSheets(remote: TrackerSheetData[]): TrackerSheet[] {
  return remote.map((s) => ({
    id: s.id,
    name: s.name,
    columns: s.columns?.length
      ? s.columns
      : Object.keys(s.rows?.[0] ?? {}).filter((k) => k !== "__assigned_to_id"),
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
      onResize(colKey, Math.max(60, startW.current + me.clientX - startX.current));
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

  const [sheets, setSheets] = useState<TrackerSheet[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [newSheetName, setNewSheetName] = useState("");
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [deleteSheetId, setDeleteSheetId] = useState<string | null>(null);
  const [clearTableOpen, setClearTableOpen] = useState(false);

  // Sync remote → local (only when not dirty)
  useEffect(() => {
    if (!remoteData || dirty) return;
    if (remoteData.sheets.length > 0) {
      const merged = mergeSheets(remoteData.sheets);
      setSheets(merged);
      setActiveSheetId((prev) => merged.find((s) => s.id === prev) ? prev : merged[0].id);
    }
  }, [remoteData]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const activeRows = activeSheet?.rows ?? [];
  const activeCols = activeSheet?.columns ?? [];

  function colWidth(col: string) {
    return colWidths[`${activeSheetId}:${col}`] ?? Math.max(130, col.length * 9);
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
        rows[rowIdx] = { ...rows[rowIdx], [col]: emp?.full_name ?? "", __assigned_to_id: empId ?? "" };
        return { ...s, rows };
      }),
    );
    setDirty(true);
  }

  function addRow() {
    if (readOnly) return;
    if (activeCols.length === 0) { toast.error("Import a file first to get columns"); return; }
    setSheets((prev) =>
      prev.map((s) => s.id === activeSheetId ? { ...s, rows: [...s.rows, emptyRow(s.columns)] } : s),
    );
    setDirty(true);
  }

  function deleteRow(idx: number) {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) => s.id === activeSheetId ? { ...s, rows: s.rows.filter((_, i) => i !== idx) } : s),
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
      if (activeSheetId === deleteSheetId) setActiveSheetId(remaining[0]?.id ?? "");
      return remaining;
    });
    setDeleteSheetId(null);
    setDirty(true);
  }

  function clearActiveSheet() {
    if (readOnly) return;
    setSheets((prev) => prev.map((s) => s.id === activeSheetId ? { ...s, rows: [] } : s));
    setClearTableOpen(false);
    setDirty(true);
    toast.success("All rows cleared");
  }

  // ── save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!userId) { toast.error("You must be signed in to save"); return; }
    setSaving(true);
    try {
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

  // ── import — reads EVERY sheet, EVERY row, EVERY cell ─────────────────

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();

      // dense:true keeps empty cells; cellDates converts dates properly
      const wb = XLSX.read(buffer, { type: "array", cellDates: true, dense: true });

      if (wb.SheetNames.length === 0) throw new Error("No sheets found in the file");

      const importedSheets: TrackerSheet[] = [];

      for (const wsName of wb.SheetNames) {
        const ws = wb.Sheets[wsName];
        if (!ws) continue;

        // Get the actual used range of the sheet
        const ref = ws["!ref"];
        if (!ref) {
          // Sheet is completely empty — add it with no data
          importedSheets.push({ id: `sheet_${wsName}_${Date.now()}`, name: wsName, columns: [], rows: [] });
          continue;
        }

        // Use sheet_to_json with header:1 to get raw 2D array.
        // defval:"" fills every missing cell so rows stay aligned.
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
          header: 1,
          defval: "",
          blankrows: true,  // keep blank rows — don't skip them
          raw: false,       // format dates/numbers as strings, just like Excel shows them
        });

        if (raw.length === 0) {
          importedSheets.push({ id: `sheet_${wsName}_${Date.now()}`, name: wsName, columns: [], rows: [] });
          continue;
        }

        // ── Find the actual header row ──
        // Skip leading empty rows to find the first row that has at least one non-empty cell
        let headerRowIdx = 0;
        for (let i = 0; i < raw.length; i++) {
          if (raw[i].some((v: any) => String(v ?? "").trim() !== "")) {
            headerRowIdx = i;
            break;
          }
        }

        // Build header — every cell becomes a column name.
        // If a cell is empty we use a positional name so column alignment is preserved.
        const rawHeader: any[] = raw[headerRowIdx] ?? [];
        const headerRow: string[] = rawHeader.map((h, i) => {
          const val = String(h ?? "").trim();
          return val !== "" ? val : `Col_${i + 1}`;
        });

        // Remove completely trailing empty placeholder columns
        // (columns that were generated only because they had no header AND no data)
        // We determine the last column that actually has data in any row
        const dataRawRows = raw.slice(headerRowIdx + 1);
        let lastUsedColIdx = headerRow.length - 1;
        while (lastUsedColIdx > 0) {
          const colHasData =
            // header had a real value
            String(rawHeader[lastUsedColIdx] ?? "").trim() !== "" ||
            // or at least one data row has something in this position
            dataRawRows.some((r) => String(r?.[lastUsedColIdx] ?? "").trim() !== "");
          if (colHasData) break;
          lastUsedColIdx--;
        }
        const finalHeaders = headerRow.slice(0, lastUsedColIdx + 1);

        // ── Build data rows — keep ALL rows, including blank ones ──
        const dataRows: TrackerRow[] = dataRawRows.map((r) => {
          const row: TrackerRow = {};
          finalHeaders.forEach((colName, i) => {
            row[colName] = String(r?.[i] ?? "");
          });
          // Try to pre-match "Assigned to" column value against known employees
          // so the UserPicker shows the right person on import
          const assignCol = finalHeaders.find((h) =>
            ASSIGN_COL_ALIASES.includes(h.toLowerCase().trim()),
          );
          if (assignCol) {
            const nameInFile = String(row[assignCol] ?? "").trim().toLowerCase();
            const matched = allEmployees.find(
              (e) => e.full_name.toLowerCase() === nameInFile,
            );
            row.__assigned_to_id = matched?.id ?? "";
          } else {
            row.__assigned_to_id = "";
          }
          return row;
        });

        importedSheets.push({
          id: `sheet_${wsName.replace(/\s+/g, "_")}_${Date.now()}`,
          name: wsName,
          columns: finalHeaders,
          rows: dataRows,
        });
      }

      if (importedSheets.length === 0) throw new Error("Could not read any sheets from the file");

      // Replace current sheets with what came from the file
      setSheets(importedSheets);
      setActiveSheetId(importedSheets[0].id);
      setDirty(true);
      if (fileInputRef.current) fileInputRef.current.value = "";

      const totalRows = importedSheets.reduce((s, sh) => s + sh.rows.length, 0);
      toast.success(
        `Imported ${importedSheets.length} sheet${importedSheets.length > 1 ? "s" : ""} · ${totalRows} rows — click Save to share`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setImporting(false);
    }
  }

  // ── export ────────────────────────────────────────────────────────────

  function exportCsv() {
    if (!activeSheet || activeCols.length === 0) { toast.error("Nothing to export"); return; }
    const lines = [
      activeCols.join(","),
      ...activeRows.map((r) =>
        activeCols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeSheet.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    toast.success("Exported to CSV");
  }

  async function exportExcel() {
    if (!activeSheet || activeCols.length === 0) { toast.error("Nothing to export"); return; }
    try {
      const XLSX = await import("xlsx");
      const data = [activeCols, ...activeRows.map((r) => activeCols.map((c) => r[c] ?? ""))];
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
          /* Empty state — no file imported yet or sheet is empty */
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
                  Click "Import Excel/CSV" to load your file. Every sheet, every row and every
                  column will appear exactly as it is in the file.
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
                      <td key={col} style={{ width: colWidth(col) }} className="border-r p-0.5">
                        {/* "Assigned to" columns → UserPicker (all employees from all depts) */}
                        {isAssignCol(col) ? (
                          readOnly ? (
                            <span className="px-2 text-xs block py-1">{row[col] || "—"}</span>
                          ) : (
                            <UserPicker
                              people={allEmployees}
                              value={row.__assigned_to_id || null}
                              onChange={(empId) => updateAssignedTo(idx, col, empId)}
                              placeholder="Select employee…"
                              compact
                            />
                          )
                        ) : (
                          /* All other columns — plain editable text input */
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
                      <td style={{ width: colWidth("__action") > 0 ? colWidth("__action") : 180 }}
                        className="p-1 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {/* Assign Task button — always visible, disabled until employee is picked */}
                          {onAssignTask && (
                            <Button size="sm"
                              variant={row.__assigned_to_id ? "default" : "outline"}
                              disabled={!row.__assigned_to_id}
                              className="h-7 text-[11px] px-2.5 gap-1 font-semibold whitespace-nowrap"
                              onClick={() => onAssignTask(row, idx, activeSheet?.name ?? "")}>
                              <Send className="size-3" />
                              {row.__assigned_to_id ? "Assign Task" : "Pick employee"}
                            </Button>
                          )}
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
                {s.name}
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
