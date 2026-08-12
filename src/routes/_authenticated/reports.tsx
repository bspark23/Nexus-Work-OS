import { useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Search, SlidersHorizontal, Trash2, Eye, Upload, Paperclip, Download, Link2, ExternalLink } from "lucide-react";
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useScope } from "@/hooks/useScope";
import { useReports, useProfiles, useDepartments } from "@/hooks/useData";
import { saveReport, deleteReport, track } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { scopeReports } from "@/lib/scope";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Report } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Nexus Work OS" },
      { name: "description", content: "Submit and review daily, weekly and monthly work reports." },
    ],
  }),
  component: ReportsPage,
});

const MAX_REPORT_FILE = 900 * 1024; // 900 KB

const empty: Partial<Report> = {
  title: "", report_type: "daily", status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
  attached_file: null, attached_file_name: null,
  report_link: null, report_link_label: null,
};

function ReportsPage() {
  const { user, profile, isAdmin, isDeptAdmin, canManage } = useAuth();
  const scope = useScope();
  const qc = useQueryClient();

  const { data: allReports = [] } = useReports();
  const { data: allProfiles = [] } = useProfiles(canManage);
  const { data: departments = [] } = useDepartments();

  const reports = scopeReports(allReports, scope);

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");

  // Dialog
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Report>>(empty);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Read-only view dialog (for admins reading other people's reports)
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  async function handleReportFileChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_REPORT_FILE) {
      toast.error(`File too large (${(file.size / 1024).toFixed(0)} KB). Max 900 KB.`);
      return;
    }
    setUploadingFile(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setDraft((d) => ({ ...d, attached_file: dataUrl, attached_file_name: file.name }));
      toast.success(`"${file.name}" attached`);
      setUploadingFile(false);
    };
    reader.onerror = () => { toast.error("Could not read file"); setUploadingFile(false); };
    reader.readAsDataURL(file);
  }

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase()) &&
          !(r.summary ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterType !== "all" && r.report_type !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterDept !== "all" && r.department_id !== filterDept) return false;
      if (filterEmployee !== "all" && r.author_id !== filterEmployee) return false;
      return true;
    });
  }, [reports, search, filterType, filterStatus, filterDept, filterEmployee]);

  async function submit() {
    if (!user) return;
    const finalTitle = draft.title?.trim() || (draft.attached_file_name ? `Report: ${draft.attached_file_name}` : "");
    if (!finalTitle) {
      toast.error("Please enter a title or attach a report file.");
      return;
    }
    const id = await saveReport({
      ...draft,
      title: finalTitle,
      author_id: draft.author_id ?? user.id,
      department_id: draft.department_id ?? profile?.department_id ?? null,
    });
    await broadcast({
      departmentId: profile?.department_id ?? null,
      title: "New report submitted",
      body: `${profile?.full_name ?? "Employee"} submitted: "${draft.title}"`,
      actorId: user.id,
      type: "report",
    });
    await track({
      actorId: user.id,
      actorName: profile?.full_name ?? "Someone",
      action: "submitted a report",
      entityType: "report",
      entityId: id,
      detail: `${profile?.full_name ?? "Someone"} submitted "${draft.title}"`,
      type: "report",
    });
    toast.success("Report submitted");
    setOpen(false);
    setDraft(empty);
    qc.invalidateQueries();
  }

  async function handleDelete(r: Report) {
    if (!confirm(`Delete report "${r.title}"? This cannot be undone.`)) return;
    try {
      await deleteReport(r.id);
      toast.success("Report deleted");
      qc.invalidateQueries();
    } catch {
      toast.error("Could not delete report");
    }
  }

  const showFilters = canManage || reports.length > 3;

  return (
    <>
      <PageHeader
        title={isAdmin ? "All Reports" : isDeptAdmin ? "Department Reports" : "My Reports"}
        subtitle={
          isAdmin ? "Every report submitted across the company."
          : isDeptAdmin ? "Reports from your department."
          : "Your daily, weekly and monthly reports."
        }
        actions={
          <Button onClick={() => { setDraft(empty); setOpen(true); }}>
            <Plus className="size-4" /> New report
          </Button>
        }
      />

      {/* ── Filters ── */}
      {showFilters && (
        <div className="surface-card flex flex-wrap items-center gap-3 p-4">
          <SlidersHorizontal className="text-muted-foreground size-4 shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input className="pl-9" placeholder="Search reports…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {REPORT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {canManage && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[170px]"><SelectValue placeholder="Employee" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {allProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(search || filterType !== "all" || filterStatus !== "all" || filterDept !== "all" || filterEmployee !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterType("all"); setFilterStatus("all"); setFilterDept("all"); setFilterEmployee("all"); }}>
              Clear
            </Button>
          )}
          <span className="text-muted-foreground ml-auto text-xs">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title={reports.length === 0 ? "No reports yet" : "No reports match your filters"}
          description={reports.length === 0 ? "Submit your first daily report." : "Try adjusting the filters."}
          action={reports.length === 0 ? (
            <Button onClick={() => { setDraft(empty); setOpen(true); }}>
              <Plus className="size-4" /> New report
            </Button>
          ) : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => {
            const author = allProfiles.find((p) => p.id === r.author_id);
            const dept = departments.find((d) => d.id === r.department_id);
            const isOwner = r.author_id === user?.id;
            const canDelete = isOwner || isAdmin;
            const canReadFull = isAdmin || isDeptAdmin || isOwner;

            return (
              <article key={r.id} className="surface-card animate-rise space-y-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{r.title}</h2>
                    <p className="text-muted-foreground text-xs">
                      {labelOf(REPORT_TYPES, r.report_type)} · {formatDate(r.report_date)}
                      {author && ` · ${author.full_name}`}
                      {dept && ` · ${dept.name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <StatusBadge
                      label={labelOf(REPORT_STATUSES, r.status)}
                      tone={toneOf(REPORT_STATUSES, r.status)}
                    />
                    {canDelete && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 ml-1"
                        onClick={() => handleDelete(r)}
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                {r.summary && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{r.summary}</p>
                )}
                {r.completed_work && (
                  <div>
                    <p className="text-xs font-medium">Completed work</p>
                    <p className="text-muted-foreground line-clamp-2 text-xs">{r.completed_work}</p>
                  </div>
                )}

                {/* Show attached file if any */}
                {r.attached_file_name && r.attached_file && (
                  <a
                    href={r.attached_file}
                    download={r.attached_file_name}
                    className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-xs hover:bg-secondary transition-colors"
                  >
                    <Paperclip className="text-muted-foreground size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">{r.attached_file_name}</span>
                    <Download className="text-muted-foreground size-3.5 shrink-0" />
                  </a>
                )}

                {/* Show reference link if any */}
                {r.report_link && (
                  <a
                    href={r.report_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-info/30 bg-info/5 px-3 py-2 text-xs hover:bg-info/10 transition-colors text-info group"
                  >
                    <Link2 className="size-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.report_link_label || r.report_link}
                    </span>
                    <ExternalLink className="size-3 shrink-0 opacity-60 group-hover:opacity-100" />
                  </a>
                )}

                <div className="flex gap-2 flex-wrap">
                  {/* Owner: edit own report */}
                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDraft(r); setOpen(true); }}
                    >
                      Open / Edit
                    </Button>
                  )}
                  {/* Anyone who can read the full report gets a Preview button */}
                  {canReadFull && (
                    <Button
                      size="sm"
                      variant={isOwner ? "ghost" : "outline"}
                      onClick={() => { setViewReport(r); setViewOpen(true); }}
                    >
                      <Eye className="size-4" /> {isOwner ? "Preview" : "Read report"}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ── Report Dialog ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Edit Report" : "New Report"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input value={draft.title ?? ""} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Report type</Label>
                <Select value={draft.report_type ?? "daily"} onValueChange={(v) => setDraft({ ...draft, report_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{REPORT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={draft.report_date ?? ""} onChange={(e) => setDraft({ ...draft, report_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Summary</Label>
              <Textarea rows={2} value={draft.summary ?? ""} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Completed work</Label>
              <Textarea rows={3} value={draft.completed_work ?? ""} onChange={(e) => setDraft({ ...draft, completed_work: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Challenges</Label>
              <Textarea rows={2} value={draft.challenges ?? ""} onChange={(e) => setDraft({ ...draft, challenges: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Achievements</Label>
              <Textarea rows={2} value={draft.achievements ?? ""} onChange={(e) => setDraft({ ...draft, achievements: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Next steps</Label>
              <Textarea rows={2} value={draft.next_steps ?? ""} onChange={(e) => setDraft({ ...draft, next_steps: e.target.value })} />
            </div>

            {/* Link section */}
            <div className="rounded-xl border border-info/20 bg-info/5 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="size-4 text-info shrink-0" />
                <p className="text-sm font-medium">Reference Link <span className="text-muted-foreground font-normal text-xs">(optional)</span></p>
              </div>
              <p className="text-muted-foreground text-xs">
                Add a link to your work — Google Drive, GitHub, Figma, Notion, YouTube, etc.
                Admins can click it to go directly to your deliverable.
              </p>
              <div className="space-y-2">
                <Label>Link URL</Label>
                <Input
                  type="url"
                  value={draft.report_link ?? ""}
                  onChange={(e) => setDraft({ ...draft, report_link: e.target.value || null })}
                  placeholder="https://drive.google.com/…  or  https://github.com/…"
                />
              </div>
              <div className="space-y-2">
                <Label>Link label <span className="text-muted-foreground font-normal text-xs">(what to show — leave blank to show the URL)</span></Label>
                <Input
                  value={draft.report_link_label ?? ""}
                  onChange={(e) => setDraft({ ...draft, report_link_label: e.target.value || null })}
                  placeholder="e.g. View my design on Figma"
                />
              </div>
            </div>

            {/* File attachment — optional */}
            <div className="space-y-2">
              <Label>
                Attach file <span className="text-muted-foreground font-normal text-xs">(optional — PDF, Word, Excel, CSV, image, max 900 KB)</span>
              </Label>
              {draft.attached_file_name ? (
                <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 px-3 py-2.5">
                  <Paperclip className="text-muted-foreground size-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm">{draft.attached_file_name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-destructive"
                    onClick={() => setDraft({ ...draft, attached_file: null, attached_file_name: null })}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingFile}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" />
                    {uploadingFile ? "Reading…" : "Upload file"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                    onChange={(e) => handleReportFileChange(e.target.files)}
                  />
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!draft.title && !draft.attached_file}>Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Full Report View Dialog (admins reading any report) ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {viewReport && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{viewReport.title}</DialogTitle>
                <p className="text-muted-foreground text-xs mt-1">
                  {labelOf(REPORT_TYPES, viewReport.report_type)} · {formatDate(viewReport.report_date)} ·{" "}
                  {allProfiles.find((p) => p.id === viewReport.author_id)?.full_name ?? "Unknown"} ·{" "}
                  {departments.find((d) => d.id === viewReport.department_id)?.name ?? "No dept"}
                </p>
              </DialogHeader>

              <div className="mt-2 space-y-4 text-sm">
                {viewReport.summary && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Summary</p>
                    <p className="leading-relaxed">{viewReport.summary}</p>
                  </section>
                )}
                {viewReport.completed_work && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Completed Work</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{viewReport.completed_work}</p>
                  </section>
                )}
                {viewReport.challenges && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Challenges</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{viewReport.challenges}</p>
                  </section>
                )}
                {viewReport.achievements && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Achievements</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{viewReport.achievements}</p>
                  </section>
                )}
                {viewReport.next_steps && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1">Next Steps</p>
                    <p className="leading-relaxed whitespace-pre-wrap">{viewReport.next_steps}</p>
                  </section>
                )}
                {!viewReport.summary && !viewReport.completed_work && !viewReport.challenges && !viewReport.achievements && !viewReport.next_steps && (
                  <p className="text-muted-foreground italic text-sm">No details were added to this report.</p>
                )}

                {/* Reference link */}
                {viewReport.report_link && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Reference Link</p>
                    <a
                      href={viewReport.report_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/5 px-4 py-2.5 text-sm text-info hover:bg-info/10 transition-colors group font-medium"
                    >
                      <Link2 className="size-4 shrink-0" />
                      <span className="truncate max-w-xs">
                        {viewReport.report_link_label || viewReport.report_link}
                      </span>
                      <ExternalLink className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
                    </a>
                    {viewReport.report_link_label && (
                      <p className="text-muted-foreground text-xs mt-1 ml-1 truncate">{viewReport.report_link}</p>
                    )}
                  </section>
                )}

                {/* Attached file */}
                {viewReport.attached_file_name && viewReport.attached_file && (
                  <section>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-2">Attached File</p>
                    <a
                      href={viewReport.attached_file}
                      download={viewReport.attached_file_name}
                      className="inline-flex items-center gap-2 rounded-lg border bg-secondary/40 px-4 py-2.5 text-sm hover:bg-secondary transition-colors"
                    >
                      <Paperclip className="text-muted-foreground size-4 shrink-0" />
                      <span className="truncate max-w-xs font-medium">{viewReport.attached_file_name}</span>
                      <Download className="text-muted-foreground size-3.5 shrink-0" />
                    </a>
                  </section>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2">
                {isAdmin && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={async () => {
                      await handleDelete(viewReport);
                      setViewOpen(false);
                      setViewReport(null);
                    }}
                  >
                    <Trash2 className="size-4" /> Delete
                  </Button>
                )}
                <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
