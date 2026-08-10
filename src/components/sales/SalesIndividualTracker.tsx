import { useState, useRef, useEffect, useCallback } from "react";
import { FileSpreadsheet, Upload, Download, Plus, Trash2, Settings2, Send, Loader2, Save, RefreshCw } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { parseJobFile } from "@/lib/job-parse";
import { UserPicker } from "@/components/common/UserPicker";
import { saveSharedTracker, type TrackerSheetData } from "@/lib/jobs-api";
import { useSharedTracker } from "@/hooks/useData";
import type { Profile } from "@/lib/types";

export type TrackerRow = {
  company_customer: string;
  country_code: string;
  phone: string;
  allow_campaign: string;
  allow_sms: string;
  services: string;
  payment_status: string;
  delivery_status: string;
  assigned_to: string;       // employee full name (display)
  assigned_to_id: string;    // employee uid
  delivery_date: string;
  comment: string;
};

export type TrackerSheet = {
  id: string;
  name: string;
  rows: TrackerRow[];
};

const ALL_MONTHS = [
  { id: "sheet1", name: "Sheet1" },
  { id: "jan", name: "JANUARY SALES" },
  { id: "feb", name: "FEBRUARY SALES" },
  { id: "mar", name: "MARCH SALES" },
  { id: "apr", name: "APRIL SALES" },
  { id: "may", name: "MAY SALES" },
  { id: "jun", name: "JUNE SALES" },
  { id: "jul", name: "JULY SALES" },
  { id: "aug", name: "AUGUST SALES" },
  { id: "sep", name: "SEPTEMBER SALES" },
  { id: "oct", name: "OCTOBER SALES" },
  { id: "nov", name: "NOVEMBER SALES" },
  { id: "dec", name: "DECEMBER SALES" },
  { id: "tshirts", name: "TSHIRTS PRODUCTION" },
];

const DEFAULT_SERVICES = [
  "T-shirt Design", "T-shirt Production", "Logo Design", "Social Media Design",
  "Video Editing", "Video Production", "Sponsored Ads", "Webonthego",
  "Graphics Design", "Web Design", "Mobile Development",
];

const DEFAULT_PAYMENT = ["Payment Made", "Pending Payment", "Partial Payment", "Refunded"];
const DEFAULT_DELIVERY = ["Delivered", "Pending Delivery", "In Progress", "Cancelled"];
const BOOL_OPTIONS = ["TRUE", "FALSE"];

const INITIAL_SHEETS: TrackerSheet[] = ALL_MONTHS.map((m) => ({ ...m, rows: [] }));

function emptyRow(): TrackerRow {
  return {
    company_customer: "",
    country_code: "234",
    phone: "",
    allow_campaign: "TRUE",
    allow_sms: "TRUE",
    services: "",
    payment_status: "Payment Made",
    delivery_status: "Delivered",
    assigned_to: "",
    assigned_to_id: "",
    delivery_date: "",
    comment: "",
  };
}

/** Merge remote sheets over local — preserving local sheets not yet in remote */
function mergeSheets(remote: TrackerSheetData[], local: TrackerSheet[]): TrackerSheet[] {
  const remoteIds = new Set(remote.map((s) => s.id));
  const remoteSheets = remote.map((s) => ({
    id: s.id,
    name: s.name,
    rows: (s.rows as TrackerRow[]) ?? [],
  }));
  // Append local-only sheets (custom sheets not yet saved)
  const localOnly = local.filter((s) => !remoteIds.has(s.id));
  return [...remoteSheets, ...localOnly];
}

export function SalesIndividualTracker({
  readOnly = false,
  allEmployees = [],
  onAssignTask,
  userId,
}: {
  readOnly?: boolean;
  /** All platform employees — shown in "Assigned to" picker */
  allEmployees?: Profile[];
  /** Called when "Assign Task" is clicked for a row */
  onAssignTask?: (row: TrackerRow, rowIdx: number, sheetName: string) => void;
  /** Current user's id — used to record who last saved */
  userId?: string;
}) {
  const qc = useQueryClient();
  const { data: remoteData, isLoading } = useSharedTracker(true);

  const [sheets, setSheets] = useState<TrackerSheet[]>(INITIAL_SHEETS);
  const [activeSheetId, setActiveSheetId] = useState("sheet1");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSheetName, setNewSheetName] = useState("");
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  // Custom dropdown options (local — per session, no need to persist these)
  const [servicesOpts, setServicesOpts] = useState(DEFAULT_SERVICES);
  const [paymentOpts, setPaymentOpts] = useState(DEFAULT_PAYMENT);
  const [deliveryOpts, setDeliveryOpts] = useState(DEFAULT_DELIVERY);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [optType, setOptType] = useState<"services" | "payment" | "delivery">("services");
  const [newOpt, setNewOpt] = useState("");

  // Sync remote → local whenever fresh data arrives (only if not dirty)
  useEffect(() => {
    if (!remoteData) return;
    if (dirty) return; // user has unsaved local edits — don't overwrite
    setSheets(mergeSheets(remoteData.sheets, INITIAL_SHEETS));
  }, [remoteData]); // eslint-disable-line react-hooks/exhaustive-deps

  const activeSheet = sheets.find((s) => s.id === activeSheetId);
  const activeRows = activeSheet?.rows ?? [];

  // ── mutations ──────────────────────────────────────────────────────────────

  function updateRow(rowIdx: number, field: keyof TrackerRow, value: string) {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        const rows = [...s.rows];
        rows[rowIdx] = { ...rows[rowIdx], [field]: value };
        return { ...s, rows };
      }),
    );
    setDirty(true);
  }

  function updateAssignedTo(rowIdx: number, empId: string | null) {
    if (readOnly) return;
    const emp = empId ? allEmployees.find((e) => e.id === empId) : null;
    setSheets((prev) =>
      prev.map((s) => {
        if (s.id !== activeSheetId) return s;
        const rows = [...s.rows];
        rows[rowIdx] = {
          ...rows[rowIdx],
          assigned_to: emp?.full_name ?? "",
          assigned_to_id: empId ?? "",
        };
        return { ...s, rows };
      }),
    );
    setDirty(true);
  }

  function addRow() {
    if (readOnly) return;
    setSheets((prev) =>
      prev.map((s) =>
        s.id === activeSheetId ? { ...s, rows: [...s.rows, emptyRow()] } : s,
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

  function addSheet() {
    const name = newSheetName.trim().toUpperCase();
    if (!name) return;
    const id = `custom_${Date.now()}`;
    setSheets((prev) => [...prev, { id, name, rows: [] }]);
    setActiveSheetId(id);
    setNewSheetName("");
    setAddSheetOpen(false);
    setDirty(true);
  }

  // ── save to Firestore ──────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!userId) {
      toast.error("You must be signed in to save");
      return;
    }
    setSaving(true);
    try {
      const payload: TrackerSheetData[] = sheets.map((s) => ({
        id: s.id,
        name: s.name,
        rows: s.rows,
      }));
      await saveSharedTracker(payload, userId);
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["shared_tracker"] });
      toast.success("Sales Tracker saved — all team members can see your changes");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save tracker");
    } finally {
      setSaving(false);
    }
  }, [sheets, userId, qc]);

  // ── import / export ────────────────────────────────────────────────────────

  async function handleUpload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    try {
      const parsed = await parseJobFile(file);
      const rows: TrackerRow[] = (parsed.rows ?? []).map((r: Record<string, string>) => ({
        company_customer: r["Company/Customer"] ?? r["company_customer"] ?? r["Customer Name"] ?? r["Name"] ?? r["A"] ?? "",
        country_code: r["CountryCode"] ?? r["country_code"] ?? r["B"] ?? "234",
        phone: r["Phone"] ?? r["phone"] ?? r["C"] ?? "",
        allow_campaign: String(r["AllowCampaign"] ?? r["allow_campaign"] ?? r["D"] ?? "TRUE").toUpperCase(),
        allow_sms: String(r["AllowSMS"] ?? r["allow_sms"] ?? r["E"] ?? "TRUE").toUpperCase(),
        services: r["Services"] ?? r["services"] ?? r["F"] ?? "",
        payment_status: r["Payment Status"] ?? r["payment_status"] ?? r["G"] ?? "Payment Made",
        delivery_status: r["Delivery Status"] ?? r["delivery_status"] ?? r["H"] ?? "Delivered",
        assigned_to: r["Assigned to"] ?? r["assigned_to"] ?? r["I"] ?? "",
        assigned_to_id: "",
        delivery_date: r["Delivery Date"] ?? r["delivery_date"] ?? r["J"] ?? "",
        comment: r["Comment"] ?? r["comment"] ?? r["K"] ?? "",
      }));
      setSheets((prev) => prev.map((s) => (s.id === activeSheetId ? { ...s, rows } : s)));
      setDirty(true);
      toast.success(`Imported ${rows.length} rows — click Save to share with team`);
    } catch {
      toast.error("Could not parse file");
    }
  }

  function exportCsv() {
    if (!activeSheet) return;
    const header = ["Company/Customer", "CountryCode", "Phone", "AllowCampaign", "AllowSMS", "Services", "Payment Status", "Delivery Status", "Assigned to", "Delivery Date", "Comment"].join(",");
    const lines = (activeSheet.rows ?? []).map((r) =>
      [r.company_customer, r.country_code, r.phone, r.allow_campaign, r.allow_sms, r.services, r.payment_status, r.delivery_status, r.assigned_to, r.delivery_date, r.comment]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${activeSheet.name.replace(/\s+/g, "_")}.csv`;
    a.click();
    toast.success("Exported to CSV");
  }

  const currentOpts = optType === "services" ? servicesOpts : optType === "payment" ? paymentOpts : deliveryOpts;
  const setCurrentOpts = optType === "services" ? setServicesOpts : optType === "payment" ? setPaymentOpts : setDeliveryOpts;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="surface-card flex flex-col overflow-hidden rounded-xl border shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-secondary/30 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="text-primary size-5" />
          <h2 className="font-semibold text-sm">Shared Sales Tracker</h2>
          {isLoading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          {!isLoading && remoteData && (
            <span className="text-[11px] text-muted-foreground">
              Last saved: {new Date(remoteData.updated_at).toLocaleString()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!readOnly && (
            <>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setOptionsOpen(true)}>
                <Settings2 className="size-3.5" /> Edit Dropdowns
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-3.5" /> Import Excel/CSV
              </Button>
              <input ref={fileInputRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => handleUpload(e.target.files)} />
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={addRow}>
                <Plus className="size-3.5" /> Add Row
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={handleSave}
                disabled={saving || !dirty}
                variant={dirty ? "default" : "outline"}
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                {dirty ? "Save Changes" : "Saved"}
              </Button>
            </>
          )}
          {readOnly && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5"
              onClick={() => qc.invalidateQueries({ queryKey: ["shared_tracker"] })}>
              <RefreshCw className="size-3.5" /> Refresh
            </Button>
          )}
          <Button size="sm" className="h-8 text-xs gap-1.5" variant="outline" onClick={exportCsv}>
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {dirty && !readOnly && (
        <div className="bg-warning/10 border-b border-warning/30 px-5 py-1.5 text-[11px] text-warning font-medium flex items-center gap-2">
          ● You have unsaved changes — click "Save Changes" to share with the whole sales team
        </div>
      )}

      {/* Table */}
      <div className="max-h-[600px] overflow-auto border-b text-xs">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-secondary/60 text-muted-foreground border-b font-semibold sticky top-0 z-10">
              <th className="w-8 border-r px-2 py-2 text-center">#</th>
              <th className="min-w-[180px] border-r px-3 py-2">Company / Customer</th>
              <th className="w-20 border-r px-2 py-2 text-center">CountryCode</th>
              <th className="w-28 border-r px-2 py-2">Phone</th>
              <th className="w-28 border-r px-2 py-2">AllowCampaign</th>
              <th className="w-24 border-r px-2 py-2">AllowSMS</th>
              <th className="min-w-[160px] border-r px-3 py-2">Services</th>
              <th className="w-36 border-r px-2 py-2">Payment Status</th>
              <th className="w-36 border-r px-2 py-2">Delivery Status</th>
              <th className="w-44 border-r px-2 py-2">Assigned to</th>
              <th className="w-28 border-r px-2 py-2">Delivery Date</th>
              <th className="min-w-[160px] border-r px-3 py-2">Comment</th>
              {!readOnly && <th className="w-36 px-2 py-2 text-center">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y">
            {activeRows.length === 0 ? (
              <tr>
                <td colSpan={13} className="py-12 text-center text-muted-foreground italic">
                  {isLoading ? "Loading shared tracker…" : 'Empty sheet. Click "Add Row" or "Import Excel/CSV" to start.'}
                </td>
              </tr>
            ) : (
              activeRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-secondary/20 transition-colors group">
                  <td className="border-r bg-secondary/10 text-[11px] text-muted-foreground text-center select-none px-1">{idx + 1}</td>

                  <td className="border-r p-1">
                    <Input value={row.company_customer} disabled={readOnly} onChange={(e) => updateRow(idx, "company_customer", e.target.value)} className="h-7 text-xs border-0 focus-visible:ring-1 bg-transparent" />
                  </td>
                  <td className="border-r p-1">
                    <Input value={row.country_code} disabled={readOnly} onChange={(e) => updateRow(idx, "country_code", e.target.value)} className="h-7 text-xs border-0 focus-visible:ring-1 bg-transparent text-center" />
                  </td>
                  <td className="border-r p-1">
                    <Input value={row.phone} disabled={readOnly} onChange={(e) => updateRow(idx, "phone", e.target.value)} className="h-7 text-xs border-0 focus-visible:ring-1 bg-transparent" />
                  </td>

                  <td className="border-r p-1">
                    <Select value={row.allow_campaign} disabled={readOnly} onValueChange={(v) => updateRow(idx, "allow_campaign", v)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{BOOL_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="border-r p-1">
                    <Select value={row.allow_sms} disabled={readOnly} onValueChange={(v) => updateRow(idx, "allow_sms", v)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue /></SelectTrigger>
                      <SelectContent>{BOOL_OPTIONS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="border-r p-1">
                    <Select value={row.services} disabled={readOnly} onValueChange={(v) => updateRow(idx, "services", v)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{servicesOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="border-r p-1">
                    <Select value={row.payment_status} disabled={readOnly} onValueChange={(v) => updateRow(idx, "payment_status", v)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{paymentOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                  <td className="border-r p-1">
                    <Select value={row.delivery_status} disabled={readOnly} onValueChange={(v) => updateRow(idx, "delivery_status", v)}>
                      <SelectTrigger className="h-7 text-xs border-0 bg-transparent"><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>{deliveryOpts.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>

                  {/* Assigned to — all platform employees (all departments) */}
                  <td className="border-r p-1 min-w-[160px]">
                    {readOnly ? (
                      <span className="px-1.5 text-xs">{row.assigned_to || "—"}</span>
                    ) : (
                      <UserPicker
                        people={allEmployees}
                        value={row.assigned_to_id || null}
                        onChange={(empId) => updateAssignedTo(idx, empId)}
                        placeholder="Assign to…"
                        compact
                      />
                    )}
                  </td>

                  <td className="border-r p-1">
                    <Input type="date" value={row.delivery_date} disabled={readOnly} onChange={(e) => updateRow(idx, "delivery_date", e.target.value)} className="h-7 text-xs border-0 focus-visible:ring-1 bg-transparent" />
                  </td>
                  <td className="border-r p-1">
                    <Input
                      value={row.comment}
                      disabled={readOnly}
                      onChange={(e) => updateRow(idx, "comment", e.target.value)}
                      className={`h-7 text-xs border-0 focus-visible:ring-1 bg-transparent ${row.comment.toUpperCase().includes("REFUND") ? "text-destructive font-bold" : ""}`}
                    />
                  </td>

                  {!readOnly && (
                    <td className="p-1 text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {row.assigned_to_id && onAssignTask ? (
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 text-[11px] px-2.5 gap-1 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold whitespace-nowrap"
                            onClick={() => onAssignTask(row, idx, activeSheet?.name ?? "")}
                          >
                            <Send className="size-3" /> Assign Task
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic whitespace-nowrap">Pick employee first</span>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteRow(idx)}>
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
      </div>

      {/* Bottom sheet tabs */}
      <div className="flex items-center gap-0.5 overflow-x-auto bg-secondary/30 px-2 py-1 border-t">
        {!readOnly && (
          <>
            <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" title="Add sheet" onClick={() => setAddSheetOpen(true)}>
              <Plus className="size-3.5" />
            </Button>
            <div className="h-4 w-px bg-border mx-1 shrink-0" />
          </>
        )}
        {sheets.map((s) => {
          const active = s.id === activeSheetId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveSheetId(s.id)}
              className={`px-3 py-1 text-[11px] font-medium rounded-t whitespace-nowrap flex items-center gap-1.5 transition-colors ${active ? "bg-background text-primary border-t-2 border-primary shadow-sm" : "text-muted-foreground hover:bg-background/60"}`}
            >
              {s.name.replace(" SALES", "").replace(" PRODUCTION", " PROD")}
              {s.rows.length > 0 && (
                <span className="bg-secondary text-[9px] px-1.5 py-0.5 rounded-full">{s.rows.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add Sheet Dialog */}
      <Dialog open={addSheetOpen} onOpenChange={setAddSheetOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Add New Sheet</DialogTitle></DialogHeader>
          <Input value={newSheetName} onChange={(e) => setNewSheetName(e.target.value)} placeholder="e.g. SEPTEMBER SALES" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSheetOpen(false)}>Cancel</Button>
            <Button onClick={addSheet} disabled={!newSheetName.trim()}>Add</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dropdowns Dialog */}
      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit Dropdown Options</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Which dropdown?</Label>
              <Select value={optType} onValueChange={(v) => setOptType(v as typeof optType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="services">Services</SelectItem>
                  <SelectItem value="payment">Payment Status</SelectItem>
                  <SelectItem value="delivery">Delivery Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border max-h-44 overflow-y-auto divide-y">
              {currentOpts.map((opt) => (
                <div key={opt} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm">{opt}</span>
                  <button className="text-muted-foreground hover:text-destructive text-lg leading-none" onClick={() => setCurrentOpts((prev) => prev.filter((o) => o !== opt))}>×</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newOpt}
                onChange={(e) => setNewOpt(e.target.value)}
                placeholder="Add new option…"
                onKeyDown={(e) => { if (e.key === "Enter" && newOpt.trim()) { setCurrentOpts((prev) => [...prev, newOpt.trim()]); setNewOpt(""); } }}
              />
              <Button onClick={() => { if (newOpt.trim()) { setCurrentOpts((prev) => [...prev, newOpt.trim()]); setNewOpt(""); } }}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <DialogFooter><Button onClick={() => setOptionsOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
