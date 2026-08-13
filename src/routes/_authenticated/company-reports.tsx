import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Search, SlidersHorizontal, Eye, Trash2, Download } from "lucide-react";
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
import { WeeklyPerformanceReport } from "@/components/common/WeeklyPerformanceReport";
import type { Report, ReportProjectRow } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/company-reports")({
  head: () => ({
    meta: [
      { title: "Company Reports — Nexus Work OS" },
      { name: "description", content: "All employee reports submitted across the company." },
    ],
  }),
  component: CompanyReports,
});

const emptyProjectRow: ReportProjectRow = {
  s_no: "", brand_name: "", project_type: "",
  date_received: "", received_from: "", time_received: "",
  date_delivered: "", delivered_to: "", time_delivered: "",
};

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
  const [exporting, setExporting] = useState(false);

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

  // ── EXPORT (same logic as reports page) ──────────────────────────────────
  async function exportReport(report: Report, authorName?: string, deptName?: string) {
    const win = window.open("", "_blank", "width=1100,height=900,scrollbars=yes");
    if (!win) {
      toast.error("Please allow pop-ups to export reports");
      return;
    }
    try {
      const author = authorName || people.find((p) => p.id === report.author_id)?.full_name || "Unknown";
      const dept = deptName || departments.find((d) => d.id === report.department_id)?.name || "—";
      const projects = report.report_projects ?? [];

      const safe = (s: unknown) => String(s ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

      const ROW_RATINGS = [
        { value: "excellent", label: "Excellent" },
        { value: "good", label: "Good" },
        { value: "fair", label: "Fair" },
        { value: "sum_optimal", label: "Sum-optimal" },
        { value: "poor", label: "Poor" },
      ];

      const ratingCell = (val: string | null) => {
        const v = val ?? "";
        return ROW_RATINGS.map((o) =>
          `<span style="border:1px solid #ccc;border-radius:4px;padding:4px 10px;margin-right:6px;display:inline-block;min-width:100px;text-align:center;${v === o.value ? "background:#0a1f3d;color:#fff;font-weight:600;" : ""}">${o.label}</span>`
        ).join("");
      };

      const displayCount = Math.max(12, projects.length);
      const projectRows = Array.from({ length: displayCount }, (_, i) => {
        const r = projects[i] ?? emptyProjectRow;
        return `<tr style="border-bottom:1px solid #ccc;">
          <td style="border-right:1px solid #ccc;text-align:center;padding:4px 6px;">${i + 1}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.brand_name)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.project_type)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.date_received)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.received_from)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.time_received)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.date_delivered)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.delivered_to)}</td>
          <td style="padding:4px 6px;">${safe(r.time_delivered)}</td>
        </tr>`;
      }).join("");

      const spacerRows = Array.from({ length: 3 }, () =>
        `<tr style="border-bottom:1px solid #ddd;height:34px;"><td style="border-right:1px solid #ddd;background:#f9fafb;"></td><td colspan="5"></td></tr>`
      ).join("");

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Weekly Performance Report — ${safe(author)}</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color:#111; margin:0; padding:20px; background:#fff; font-size:13px; }
        .header { background: linear-gradient(110deg, #c7ecf7 0%, #c7ecf7 32%, #0a1f3d 32%, #0a1f3d 75%, #2a446b 75%, #2a446b 100%); padding:30px; border-radius:10px; min-height:130px; display:grid; grid-template-columns: 1fr 2fr; align-items:center; }
        .logo { text-align:center; color:#0a1f3d; font-weight:800; }
        .logo-mark { width:80px; height:80px; border-radius:50%; background:#0a1f3d; margin:0 auto 6px; position:relative; color:#fff; display:flex; align-items:center; justify-content:center; font-size:32px; font-weight:900;}
        .logo-mark::before { content:""; position:absolute; top:14px; left:22px; width:10px; height:10px; border-radius:50%; background:#f7a03c; }
        .title { color:#fff; font-weight:900; line-height:1.1; letter-spacing:0.5px; padding-left:20px;}
        .title div { font-size:30px; }
        table { width:100%; border-collapse:collapse; font-size:12px; }
        .section-head { text-align:center; font-weight:700; padding:10px; border-top:2px solid #888; border-left:1px solid #888; border-right:1px solid #888; font-size:15px; letter-spacing:1px;}
        .note-box { border-left:1px solid #888; border-right:1px solid #888; border-bottom:2px solid #888; padding:20px 28px; }
        .shaded { background:#f3f4f6; font-weight:600; }
        .meta, .foot { margin-top:8px; color:#555; font-size:11px;}
        .big-border { border: 2px solid #888; }
        .btn-bar { background:#f1f5f9; padding:10px; position:sticky; top:0; z-index:10; border-bottom:1px solid #ddd; display:flex; gap:8px; justify-content:flex-end;}
        button { padding:8px 16px; border:none; background:#0a1f3d; color:#fff; border-radius:6px; cursor:pointer; font-weight:600;}
        button.sec { background:#64748b; }
        .link { padding:8px 14px; border:1px solid #0ea5e9; background:#f0f9ff; color:#0369a1; border-radius:6px; text-decoration:none; display:inline-flex; gap:6px; align-items:center; }
      </style>
      </head><body>
        <div class="btn-bar">
          <div style="flex:1; color:#334155; font-weight:600; padding:6px 0;">Weekly Performance Report Export</div>
          <button class="sec" onclick="window.close()">Close</button>
          <button onclick="window.print()">🖨️ Print / Save PDF</button>
        </div>

        <div class="meta"><strong>Employee:</strong> ${safe(author)} · <strong>Department:</strong> ${safe(dept)} · <strong>Report date:</strong> ${safe(formatDate(report.report_date))} · <strong>Type:</strong> ${safe(labelOf(REPORT_TYPES, report.report_type))}</div>

        <div class="header">
          <div class="logo">
            <div class="logo-mark">iB</div>
            <div>iBrand <span style="color:#f7a03c;">Africa™</span></div>
          </div>
          <div class="title">
            <div>${safe(report.report_banner_line1 || "DESIGNERS' WEEKLY")}</div>
            <div>${safe(report.report_banner_line2 || "PERFORMANCE")}</div>
            <div>${safe(report.report_banner_line3 || "REPORT FORM")}</div>
          </div>
        </div>

        <div>
          <div class="section-head">NOTE</div>
          <div class="note-box">
            <p style="margin:0;"><strong>NOTE:</strong> This form is designed to monitor operational output, and project progress for each team member.</p>
          </div>
        </div>

        <div>
          <div class="section-head">INDIVIDUAL INFORMATION</div>
          <table class="big-border" style="border-top:none;">
            <tr><td class="shaded" style="width:18%;border-right:1px solid #888;padding:6px 10px;">Name</td>
              <td style="width:32%;border-right:1px solid #888;padding:6px 10px;">${safe(report.report_employee_name)}</td>
              <td class="shaded" style="width:20%;border-right:1px solid #888;padding:6px 10px;">Week Ending (Date)</td>
              <td style="padding:6px 10px;">${safe(report.report_week_ending)}</td></tr>
            <tr><td class="shaded" style="border-right:1px solid #888;border-top:1px solid #888;padding:6px 10px;">Designation/Role</td>
              <td style="border-right:1px solid #888;border-top:1px solid #888;padding:6px 10px;">${safe(report.report_designation)}</td>
              <td class="shaded" style="border-right:1px solid #888;border-top:1px solid #888;padding:6px 10px;">Supervisor/Team Lead</td>
              <td style="border-top:1px solid #888;padding:6px 10px;">${safe(report.report_supervisor)}</td></tr>
          </table>
        </div>

        <div style="margin-top:2px;">
          <div class="section-head">PROJECTS</div>
          <table class="big-border" style="border-top:none; font-size:11px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="border-right:1px solid #888;padding:6px;">S/No</th>
              <th style="border-right:1px solid #888;padding:6px;">Brand Name</th>
              <th style="border-right:1px solid #888;padding:6px;">Project Type</th>
              <th style="border-right:1px solid #888;padding:6px;">Date Received</th>
              <th style="border-right:1px solid #888;padding:6px;">Received From</th>
              <th style="border-right:1px solid #888;padding:6px;">Time Received</th>
              <th style="border-right:1px solid #888;padding:6px;">Date Delivered</th>
              <th style="border-right:1px solid #888;padding:6px;">Delivered to</th>
              <th style="padding:6px;">Time Delivered</th>
            </tr></thead>
            <tbody>${projectRows}</tbody>
          </table>
        </div>

        <div style="margin-top:2px;">
          <div class="section-head">PERFORMANCE SUMMARY</div>
          <table class="big-border" style="border-top:none;">
            <tr>
              <td class="shaded" style="width:22%;border-right:1px solid #888;padding:8px 10px;">Number of Projects Received</td>
              <td style="width:11%;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.perf_projects_received)}</td>
              <td class="shaded" style="width:23%;border-right:1px solid #888;padding:8px 10px;">Number of Projects Delivered</td>
              <td style="width:11%;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.perf_projects_delivered)}</td>
              <td class="shaded" style="padding:8px 10px;">Number of Projects on-going</td>
              <td style="padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.perf_projects_ongoing)}</td>
            </tr>
            <tr>
              <td class="shaded" style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;">Projects with pending feedback</td>
              <td style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.perf_pending_feedback)}</td>
              <td class="shaded" colspan="2" style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;">Remark</td>
              <td colspan="2" style="border-top:1px solid #888;padding:8px 10px;white-space:pre-wrap;">${safe(report.perf_remark)}</td>
            </tr>
          </table>
        </div>

        <div style="margin-top:2px;">
          <div class="section-head">SELF EVALUATION</div>
          <table class="big-border" style="border-top:none;">
            <tr>
              <td class="shaded" style="width:28%;border-right:1px solid #888;padding:8px 10px;vertical-align:top;">How would you rate your performance this week?</td>
              <td colspan="5" style="padding:8px 10px;">${ratingCell(report.self_eval_rating)}</td>
            </tr>
            <tr><td class="shaded" style="border-right:1px solid #888;border-top:1px solid #ccc;padding:8px 10px;vertical-align:top;">Key Strategies that worked this week:</td><td colspan="5" style="border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;">${safe(report.self_eval_strategies)}</td></tr>
            <tr><td class="shaded" style="border-right:1px solid #888;border-top:1px solid #ccc;padding:8px 10px;vertical-align:top;">Key areas for improvement</td><td colspan="5" style="border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;">${safe(report.self_eval_improvement)}</td></tr>
            <tr><td class="shaded" style="border-right:1px solid #888;border-top:1px solid #ccc;padding:8px 10px;vertical-align:top;">Upcoming projects/targets for next week</td><td colspan="5" style="border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;">${safe(report.self_eval_upcoming)}</td></tr>
            <tr><td class="shaded" style="border-right:1px solid #888;border-top:1px solid #ccc;padding:8px 10px;vertical-align:top;">Key Challenges, Impact on performance and recommendations</td><td colspan="5" style="border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;">${safe(report.self_eval_challenges)}</td></tr>
            ${spacerRows}
          </table>
        </div>

        <div style="margin-top:2px;">
          <table class="big-border">
            <tr>
              <td class="shaded" style="width:55%;border-right:1px solid #888;padding:6px 10px;vertical-align:top;">Supervisor's Remark</td>
              <td style="padding:6px 10px;vertical-align:top;">Supervisor's Sign/Date</td>
            </tr>
            <tr>
              <td style="border-right:1px solid #888;border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;min-height:60px;">${safe(report.supervisor_remark)}</td>
              <td style="border-top:1px solid #ccc;padding:8px 10px;white-space:pre-wrap;min-height:60px;">${safe(report.supervisor_sign_date)}</td>
            </tr>
          </table>
        </div>

        ${report.report_link ? `
          <div style="margin-top:16px; padding:14px; border:1px solid #0ea5e9; background:#f0f9ff; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;color:#0369a1;">🔗 Reference Link</div>
            <a class="link" href="${safe(report.report_link)}" target="_blank" rel="noopener">
              🔗 ${safe(report.report_link_label || report.report_link)}
            </a>
          </div>` : ""}

        ${report.attached_file_name ? `
          <div style="margin-top:10px; padding:14px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;">📎 Attached File</div>
            <a class="link" href="${safe(report.attached_file!)}" download="${safe(report.attached_file_name!)}" style="border-color:#94a3b8;background:#f8fafc;color:#334155;">
              📎 ${safe(report.attached_file_name)}
            </a>
          </div>` : ""}

        <div class="foot" style="margin-top:22px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px;">
          iBrand Africa — Designers' Weekly Performance Report Form · Generated ${new Date().toLocaleString()}
        </div>
      </body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (e) {
      toast.error("Export failed");
      win.close();
    }
  }

  async function exportAllReports(list: Report[]) {
    if (list.length === 0) {
      toast.error("No reports to export");
      return;
    }
    setExporting(true);
    try {
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        const author = people.find((p) => p.id === r.author_id)?.full_name || "Unknown";
        const dept = departments.find((d) => d.id === r.department_id)?.name || "—";
        await exportReport(r, author, dept);
        if (i < list.length - 1) await new Promise((res) => setTimeout(res, 400));
      }
      toast.success(`Exported ${list.length} report${list.length !== 1 ? "s" : ""} — each opened in a new tab (Print → Save as PDF)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
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

  if (!isAdmin) {
    return (
      <div className="text-muted-foreground flex h-60 items-center justify-center text-sm">
        Super Admin access required.
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Company Reports"
        subtitle="Every report submitted by the team — read, filter and manage."
        actions={
          filtered.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportAllReports(filtered)}
              disabled={exporting}
              className="gap-1.5"
            >
              <Download className="size-4" />
              {exporting ? "Exporting…" : `Export ${filtered.length} report${filtered.length !== 1 ? "s" : ""}`}
            </Button>
          )
        }
      />

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
                  {/* Show iBrand details as preview */}
                  {(r.report_employee_name || r.report_week_ending) && (
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {r.report_employee_name && <>👤 {r.report_employee_name}{r.report_week_ending && " · "}</>}
                      {r.report_week_ending && <>📅 Week ending {r.report_week_ending}</>}
                    </p>
                  )}
                  {r.summary && (
                    <p className="text-muted-foreground line-clamp-1 mt-0.5 text-xs">{r.summary}</p>
                  )}
                </div>
                <StatusBadge label={labelOf(REPORT_STATUSES, r.status)} tone={toneOf(REPORT_STATUSES, r.status)} />
                <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
                  onClick={() => exportReport(r)}>
                  <Download className="size-3.5" /> Export
                </Button>
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

      {/* Full Report View Dialog — uses iBrand template */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl p-0">
          {viewReport && (
            <>
              <div className="sticky top-0 z-20 border-b bg-background px-6 py-3.5 flex flex-wrap items-start justify-between gap-3">
                <DialogHeader>
                  <DialogTitle>{viewReport.title}</DialogTitle>
                  <p className="text-muted-foreground text-xs mt-1">
                    {people.find((p) => p.id === viewReport.author_id)?.full_name ?? "Unknown"} ·{" "}
                    {departments.find((d) => d.id === viewReport.department_id)?.name ?? "No dept"} ·{" "}
                    {labelOf(REPORT_TYPES, viewReport.report_type)} · {formatDate(viewReport.report_date)}
                  </p>
                </DialogHeader>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="gap-1.5 h-9"
                    onClick={() => exportReport(viewReport)}>
                    <Download className="size-4" /> Export PDF
                  </Button>
                  <Button variant="destructive" size="sm" className="gap-1.5 h-9" onClick={async () => {
                    await handleDelete(viewReport);
                    setViewOpen(false);
                    setViewReport(null);
                  }}>
                    <Trash2 className="size-4" /> Delete
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={() => setViewOpen(false)}>Close</Button>
                </div>
              </div>

              <div className="px-6 py-5">
                <WeeklyPerformanceReport
                  readOnly={true}
                  data={viewReport}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
