import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Search, SlidersHorizontal, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfiles, useReports, useDepartments } from "@/hooks/useData";
import { useAuth } from "@/hooks/useAuth";
import { deleteReport } from "@/lib/api";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import type { Report } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/company-reports")({
  head: () => ({
    meta: [
      { title: "Company Reports — Nexus Work OS" },
      { name: "description", content: "All employee reports submitted across the company." },
    ],
  }),
  component: CompanyReports,
});

function CompanyReports() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data: reports = [] } = useReports(isAdmin);
  const { data: people = [] } = useProfiles(isAdmin);
  const { data: departments = [] } = useDepartments();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");

  // Full detail view
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

  if (!isAdmin) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        Super Admin access required.
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Company Reports" subtitle="Every report submitted by the team — read, filter and manage." />

      {/* Filters */}
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
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Employee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterType !== "all" || filterStatus !== "all" || filterDept !== "all" || filterEmployee !== "all") && (
          <Button variant="ghost" size="sm" onClick={() => {
            setSearch(""); setFilterType("all"); setFilterStatus("all");
            setFilterDept("all"); setFilterEmployee("all");
          }}>Clear</Button>
        )}
        <span className="text-muted-foreground ml-auto text-xs">{filtered.length} of {reports.length}</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="size-6" />}
          title={reports.length === 0 ? "No reports submitted yet" : "No reports match your filters"}
          description={reports.length === 0 ? "Employee reports will appear here." : "Try clearing the filters."}
        />
      ) : (
        <div className="surface-card animate-rise divide-y">
          {filtered.map((r) => {
            const author = people.find((p) => p.id === r.author_id);
            const dept = departments.find((d) => d.id === r.department_id);
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-muted-foreground text-xs">
                    {author?.full_name ?? "Unknown"} · {dept?.name ?? "No dept"} ·{" "}
                    {labelOf(REPORT_TYPES, r.report_type)} · {formatDate(r.report_date)}
                  </p>
                  {r.summary && (
                    <p className="text-muted-foreground line-clamp-1 mt-0.5 text-xs">{r.summary}</p>
                  )}
                </div>
                <StatusBadge label={labelOf(REPORT_STATUSES, r.status)} tone={toneOf(REPORT_STATUSES, r.status)} />
                <Button size="sm" variant="outline" className="h-8 gap-1.5"
                  onClick={() => { setViewReport(r); setViewOpen(true); }}>
                  <Eye className="size-3.5" /> Read
                </Button>
                <Button size="icon" variant="ghost" className="size-8"
                  onClick={() => handleDelete(r)}>
                  <Trash2 className="text-destructive size-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Full Report View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {viewReport && (
            <>
              <DialogHeader>
                <DialogTitle>{viewReport.title}</DialogTitle>
                <p className="text-muted-foreground text-xs mt-1">
                  {people.find((p) => p.id === viewReport.author_id)?.full_name ?? "Unknown"} ·{" "}
                  {departments.find((d) => d.id === viewReport.department_id)?.name ?? "No dept"} ·{" "}
                  {labelOf(REPORT_TYPES, viewReport.report_type)} · {formatDate(viewReport.report_date)}
                </p>
              </DialogHeader>

              <div className="mt-2 space-y-5 text-sm">
                {[
                  { label: "Summary", value: viewReport.summary },
                  { label: "Completed Work", value: viewReport.completed_work },
                  { label: "Challenges", value: viewReport.challenges },
                  { label: "Achievements", value: viewReport.achievements },
                  { label: "Next Steps", value: viewReport.next_steps },
                ].filter((s) => s.value).map((s) => (
                  <section key={s.label}>
                    <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                      {s.label}
                    </p>
                    <p className="leading-relaxed whitespace-pre-wrap">{s.value}</p>
                  </section>
                ))}
                {!viewReport.summary && !viewReport.completed_work && !viewReport.challenges && !viewReport.achievements && !viewReport.next_steps && (
                  <p className="text-muted-foreground italic">No details were added to this report.</p>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="destructive" size="sm" onClick={async () => {
                  await handleDelete(viewReport);
                  setViewOpen(false);
                  setViewReport(null);
                }}>
                  <Trash2 className="size-4" /> Delete
                </Button>
                <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
