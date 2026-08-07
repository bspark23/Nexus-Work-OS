import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Plus, Search, SlidersHorizontal, Trash2, Eye } from "lucide-react";
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

const empty: Partial<Report> = {
  title: "", report_type: "daily", status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
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
  // Read-only view dialog (for admins reading other people's reports)
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

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
    if (!draft.title || !user) return;
    const id = await saveReport({
      ...draft,
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

                <div className="flex gap-2 flex-wrap">
                  {/* Admin/Dept Admin: read full report */}
                  {canReadFull && !isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setViewReport(r); setViewOpen(true); }}
                    >
                      <Eye className="size-4" /> Read report
                    </Button>
                  )}
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
                  {/* Super admin can also read own reports */}
                  {isAdmin && isOwner && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setViewReport(r); setViewOpen(true); }}
                    >
                      <Eye className="size-4" /> Preview
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={!draft.title}>Submit report</Button>
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
