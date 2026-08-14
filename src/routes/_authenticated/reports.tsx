import { useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Eye,
  Upload,
  Paperclip,
  Download,
  Link2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useScope } from "@/hooks/useScope";
import { useReports, useProfiles, useDepartments } from "@/hooks/useData";
import useAppSettings from "@/hooks/useAppSettings";
import useOriginalSuperAdmin from "@/hooks/useOriginalSuperAdmin";
import { saveReport, deleteReport, track } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { scopeReports } from "@/lib/scope";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { WeeklyPerformanceReport } from "@/components/common/WeeklyPerformanceReport";
import { SalesPerformanceReport } from "@/components/common/SalesPerformanceReport";
import type { Report, ReportProjectRow, SalesProjectRow, SalesInvoiceItem } from "@/lib/types";

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

const emptyProjectRow: ReportProjectRow = {
  s_no: "",
  brand_name: "",
  project_type: "",
  date_received: "",
  received_from: "",
  time_received: "",
  date_delivered: "",
  delivered_to: "",
  time_delivered: "",
};

// 12 empty rows as default — same as sample image
const defaultProjects: ReportProjectRow[] = Array.from({ length: 12 }, (_, i) => ({
  ...emptyProjectRow,
  s_no: String(i + 1),
}));

const emptySalesProjectRow: SalesProjectRow = {
  s_no: "",
  brand_name: "",
  contact_number: "",
  project_type: "",
  project_value_n: "",
  date_confirmed: "",
  category_location: "",
  edo: "",
  assigned_official: "",
};

const defaultSalesProjects: SalesProjectRow[] = Array.from({ length: 12 }, (_, i) => ({
  ...emptySalesProjectRow,
  s_no: String(i + 1),
}));

const emptyInvoiceItem: SalesInvoiceItem = {
  s_no: "",
  item: "",
  total_cost: "",
};

const defaultInvoiceItems: SalesInvoiceItem[] = Array.from({ length: 5 }, (_, i) => ({
  ...emptyInvoiceItem,
  s_no: String(i + 1),
}));

const empty: Partial<Report> = {
  title: "",
  report_type: "daily",
  status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
  attached_file: null,
  attached_file_name: null,
  report_link: null,
  report_link_label: null,
  // iBrand structured fields default empty
  report_banner_line1: "DESIGNERS' WEEKLY",
  report_banner_line2: "PERFORMANCE",
  report_banner_line3: "REPORT FORM",
  report_employee_name: null,
  report_designation: null,
  report_week_ending: new Date().toISOString().slice(0, 10),
  report_supervisor: null,
  report_projects: defaultProjects,
  perf_projects_received: "",
  perf_projects_delivered: "",
  perf_projects_ongoing: "",
  perf_pending_feedback: "",
  perf_remark: null,
  self_eval_rating: null,
  self_eval_strategies: null,
  self_eval_improvement: null,
  self_eval_upcoming: null,
  self_eval_challenges: null,
  supervisor_remark: null,
  supervisor_sign_date: null,
  is_sales_report: false,
  // Also keep old fields for backwards compat
  summary: null,
  completed_work: null,
  challenges: null,
  achievements: null,
  next_steps: null,
};

const emptySales: Partial<Report> = {
  title: "",
  report_type: "weekly",
  status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
  attached_file: null,
  attached_file_name: null,
  report_link: null,
  report_link_label: null,
  // CSR/Sales banner
  report_banner_line1: "CSR WEEKLY",
  report_banner_line2: "PERFORMANCE",
  report_banner_line3: "REPORT FORM",
  report_employee_name: null,
  report_designation: null,
  report_week_ending: new Date().toISOString().slice(0, 10),
  report_supervisor: null,
  // Normal report projects (empty, not used for sales)
  report_projects: defaultProjects,
  perf_projects_received: "",
  perf_projects_delivered: "",
  perf_projects_ongoing: "",
  perf_pending_feedback: "",
  perf_remark: null,
  // Sales-specific projects
  sales_projects: defaultSalesProjects,
  // Sales performance summary
  sales_perf_number_of_projects: "",
  sales_perf_total_project_value: "",
  sales_perf_variance_against_target: "",
  sales_perf_net_indicator: "",
  sales_perf_leads_generated: "",
  sales_perf_proposals_sent: "",
  sales_perf_total_pending_deals: "",
  sales_perf_total_completed_projects: "",
  // Self evaluation + supervisor (same as normal report)
  self_eval_rating: null,
  self_eval_strategies: null,
  self_eval_improvement: null,
  self_eval_upcoming: null,
  self_eval_challenges: null,
  supervisor_remark: null,
  supervisor_sign_date: null,
  // Mark as sales report
  is_sales_report: true,
  // Invoice defaults
  invoice_company_address: "House 5, 5th Street, Elekahia Housing Estate, Port Harcourt.",
  invoice_company_phone: "0802-126-0000",
  invoice_company_fax: "0803-747-8593",
  invoice_company_email: "info@ibrand",
  invoice_company_website: "www.ibrand",
  invoice_bill_to_name: "The Management",
  invoice_bill_to_address: null,
  invoice_bill_to_email: null,
  invoice_bill_to_phone: null,
  invoice_number: null,
  invoice_date: new Date().toISOString().slice(0, 10),
  invoice_items: defaultInvoiceItems,
  invoice_total: "",
  invoice_bank_account_name: "iBrand Africa Ltd",
  invoice_bank_account_number: "5600779289",
  invoice_bank_name: "Fidelity Bank PLC",
  invoice_footer_note:
    "All payments should be made to accounts bearing iBrand Africa. Any payment made to accounts with another name will not be acknowledged.",
  // Backwards compat
  summary: null,
  completed_work: null,
  challenges: null,
  achievements: null,
  next_steps: null,
};

function ReportsPage() {
  const { user, profile, isAdmin, isDeptAdmin, canManage } = useAuth();
  const qc = useQueryClient();

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT TOP
  const appSettings = useAppSettings();
  const isOriginalSuper = useOriginalSuperAdmin();
  const scope = useScope();

  const { data: allReports = [] } = useReports();
  const { data: allProfiles = [] } = useProfiles(canManage);
  const { data: departments = [] } = useDepartments();

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [filterEmployee, setFilterEmployee] = useState("all");

  // Dialogs
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Report>>(empty);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Compute reports based on scope (must be before early returns)
  const reports = scopeReports(allReports, scope);

  // Filtered reports (useMemo must be called before any returns)
  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (
        search &&
        !r.title.toLowerCase().includes(search.toLowerCase()) &&
        !(r.summary ?? "").toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (filterType !== "all" && r.report_type !== filterType) return false;
      if (filterStatus !== "all" && r.status !== filterStatus) return false;
      if (filterDept !== "all" && r.department_id !== filterDept) return false;
      if (filterEmployee !== "all" && r.author_id !== filterEmployee) return false;
      return true;
    });
  }, [reports, search, filterType, filterStatus, filterDept, filterEmployee]);

  // NOW check loading and access AFTER all hooks
  if (appSettings.loading) {
    return (
      <div className="flex h-60 items-center justify-center">
        <FileText className="text-muted-foreground size-6 animate-spin" />
      </div>
    );
  }

  // Restrict Reports page to the original Super Admin only unless enabled in Admin Panel
  if (!isOriginalSuper && !appSettings.showReports) {
    return (
      <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 text-sm">
        <FileText className="size-8 opacity-30" />
        <p>
          This page is only available to the original Super Admin (enable in Admin Panel to allow
          others).
        </p>
      </div>
    );
  }

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
    reader.onerror = () => {
      toast.error("Could not read file");
      setUploadingFile(false);
    };
    reader.readAsDataURL(file);
  }

  // ── EXPORT ──────────────────────────────────────────────────────────────
  async function exportReport(report: Report, authorName?: string, deptName?: string) {
    // Create an off-screen hidden container to render the report exactly as in-platform
    const win = window.open("", "_blank", "width=1100,height=900,scrollbars=yes");
    if (!win) {
      toast.error("Please allow pop-ups to export reports");
      return;
    }
    try {
      // Build document by copying our existing styled report element by using the view component's content
      // Simpler approach: inject HTML with the same table structure
      const author =
        authorName || allProfiles.find((p) => p.id === report.author_id)?.full_name || "Unknown";
      const dept = deptName || departments.find((d) => d.id === report.department_id)?.name || "—";
      const projects = report.report_projects ?? [];
      const rating: Record<string, string> = {
        excellent: "Excellent",
        good: "Good",
        fair: "Fair",
        sum_optimal: "Sum-optimal",
        poor: "Poor",
      };

      const safe = (s: unknown) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");

      const ratingCell = (val: string | null) => {
        const v = val ?? "";
        return ROW_RATINGS.map(
          (o) =>
            `<span style="border:1px solid #ccc;border-radius:4px;padding:4px 10px;margin-right:6px;display:inline-block;min-width:100px;text-align:center;${v === o.value ? "background:#0a1f3d;color:#fff;font-weight:600;" : ""}">${o.label}</span>`,
        ).join("");
      };

      const ROW_RATINGS = [
        { value: "excellent", label: "Excellent" },
        { value: "good", label: "Good" },
        { value: "fair", label: "Fair" },
        { value: "sum_optimal", label: "Sum-optimal" },
        { value: "poor", label: "Poor" },
      ];

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

      const spacerRows = Array.from(
        { length: 3 },
        () =>
          `<tr style="border-bottom:1px solid #ddd;height:34px;"><td style="border-right:1px solid #ddd;background:#f9fafb;"></td><td colspan="5"></td></tr>`,
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

        ${
          report.report_link
            ? `
          <div style="margin-top:16px; padding:14px; border:1px solid #0ea5e9; background:#f0f9ff; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;color:#0369a1;">🔗 Reference Link</div>
            <a class="link" href="${safe(report.report_link)}" target="_blank" rel="noopener">
              🔗 ${safe(report.report_link_label || report.report_link)}
            </a>
          </div>`
            : ""
        }

        ${
          report.attached_file_name
            ? `
          <div style="margin-top:10px; padding:14px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;">📎 Attached File</div>
            <a class="link" href="${safe(report.attached_file!)}" download="${safe(report.attached_file_name!)}" style="border-color:#94a3b8;background:#f8fafc;color:#334155;">
              📎 ${safe(report.attached_file_name)}
            </a>
          </div>`
            : ""
        }

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
        const author = allProfiles.find((p) => p.id === r.author_id)?.full_name || "Unknown";
        const dept = departments.find((d) => d.id === r.department_id)?.name || "—";
        if (r.is_sales_report) {
          await exportSalesReport(r, author, dept);
        } else {
          await exportReport(r, author, dept);
        }
        if (i < list.length - 1) await new Promise((res) => setTimeout(res, 400));
      }
      toast.success(
        `Exported ${list.length} report${list.length !== 1 ? "s" : ""} — each opened in a new tab (Print → Save as PDF)`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function exportSalesReport(report: Report, authorName?: string, deptName?: string) {
    const win = window.open("", "_blank", "width=1100,height=900,scrollbars=yes");
    if (!win) {
      toast.error("Please allow pop-ups to export reports");
      return;
    }
    try {
      const author =
        authorName || allProfiles.find((p) => p.id === report.author_id)?.full_name || "Unknown";
      const dept = deptName || departments.find((d) => d.id === report.department_id)?.name || "—";
      const salesProjects = report.sales_projects ?? [];
      const invoiceItems = report.invoice_items ?? [];
      const rating: Record<string, string> = {
        excellent: "Excellent",
        good: "Good",
        fair: "Fair",
        sum_optimal: "Sum-optimal",
        poor: "Poor",
      };

      const safe = (s: unknown) =>
        String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;");

      const ROW_RATINGS_LOCAL = [
        { value: "excellent", label: "Excellent" },
        { value: "good", label: "Good" },
        { value: "fair", label: "Fair" },
        { value: "sum_optimal", label: "Sum-optimal" },
        { value: "poor", label: "Poor" },
      ];

      const ratingCell = (val: string | null) => {
        const v = val ?? "";
        return ROW_RATINGS_LOCAL.map(
          (o) =>
            `<span style="border:1px solid #ccc;border-radius:4px;padding:4px 10px;margin-right:6px;display:inline-block;min-width:100px;text-align:center;${v === o.value ? "background:#0a1f3d;color:#fff;font-weight:600;" : ""}">${o.label}</span>`,
        ).join("");
      };

      const displaySalesCount = Math.max(12, salesProjects.length);
      const salesProjectRows = Array.from({ length: displaySalesCount }, (_, i) => {
        const r = salesProjects[i] ?? emptySalesProjectRow;
        return `<tr style="border-bottom:1px solid #ccc;">
          <td style="border-right:1px solid #ccc;text-align:center;padding:4px 6px;">${i + 1}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.brand_name)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.contact_number)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.project_type)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;text-align:right;">${safe(r.project_value_n)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.date_confirmed)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;">${safe(r.category_location)}</td>
          <td style="border-right:1px solid #ccc;padding:4px 6px;text-align:center;">${safe(r.edo)}</td>
          <td style="padding:4px 6px;">${safe(r.assigned_official)}</td>
        </tr>`;
      }).join("");

      const displayInvoiceCount = Math.max(5, invoiceItems.length);
      const invoiceRows = Array.from({ length: displayInvoiceCount }, (_, i) => {
        const r = invoiceItems[i] ?? emptyInvoiceItem;
        return `<tr style="border-bottom:1px solid #eee;">
          <td style="padding:6px 10px;border-right:1px solid #eee;">
            <span style="color:#666;font-size:11px;font-weight:600;margin-right:8px;">${i + 1}</span>
            <span style="font-weight:500;">${safe(r.item)}</span>
          </td>
          <td style="padding:6px 10px;text-align:right;font-weight:600;">${safe(r.total_cost)}</td>
        </tr>`;
      }).join("");

      const spacerRows = Array.from(
        { length: 3 },
        () =>
          `<tr style="border-bottom:1px solid #ddd;height:34px;"><td style="border-right:1px solid #ddd;background:#f9fafb;"></td><td colspan="5"></td></tr>`,
      ).join("");

      const html = `<!doctype html><html><head><meta charset="utf-8"><title>CSR / Sales Weekly Performance Report — ${safe(author)}</title>
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
        .invoice-header { background:#e6a817; padding:12px 16px; font-weight:700; color:#fff; display:flex; align-items:center; gap:8px;}
        .invoice-company { border:1px solid #e6a817; display:grid; grid-template-columns:1fr 2fr; margin-bottom:20px;}
        .invoice-company > div:first-child { padding:16px; border-right:1px solid #e6a817; font-weight:900; font-size:22px; color:#0a1f3d;}
        .invoice-company > div:last-child { padding:16px;}
      </style>
      </head><body>
        <div class="btn-bar">
          <div style="flex:1; color:#334155; font-weight:600; padding:6px 0;">CSR / Sales Weekly Performance Report Export</div>
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
            <div>${safe(report.report_banner_line1 || "CSR WEEKLY")}</div>
            <div>${safe(report.report_banner_line2 || "PERFORMANCE")}</div>
            <div>${safe(report.report_banner_line3 || "REPORT FORM")}</div>
          </div>
        </div>

        <div>
          <div class="section-head">NOTE</div>
          <div class="note-box">
            <p style="margin:0;"><strong>NOTE:</strong> This form is designed to monitor marketing output, revenue generation, and project progress for each team member. Each individual is expected to meet or exceed the weekly performance threshold of <strong>₦1,500,000</strong> through ongoing or completed projects.</p>
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
          <div class="section-head">PROJECTS (SALES)</div>
          <table class="big-border" style="border-top:none; font-size:11px;">
            <thead><tr style="background:#f3f4f6;">
              <th style="border-right:1px solid #888;padding:6px;">S/No</th>
              <th style="border-right:1px solid #888;padding:6px;">Brand Name</th>
              <th style="border-right:1px solid #888;padding:6px;">Contact</th>
              <th style="border-right:1px solid #888;padding:6px;">Project Type</th>
              <th style="border-right:1px solid #888;padding:6px;">Value ₦</th>
              <th style="border-right:1px solid #888;padding:6px;">Date Confirmed</th>
              <th style="border-right:1px solid #888;padding:6px;">Category/Location</th>
              <th style="border-right:1px solid #888;padding:6px;">EDO</th>
              <th style="padding:6px;">Assigned Official</th>
            </tr></thead>
            <tbody>${salesProjectRows}</tbody>
          </table>
        </div>

        <div style="margin-top:2px;">
          <div class="section-head">PERFORMANCE SUMMARY</div>
          <table class="big-border" style="border-top:none;">
            <tr>
              <td class="shaded" style="width:22%;border-right:1px solid #888;padding:8px 10px;">Number of Projects</td>
              <td style="width:11%;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_number_of_projects)}</td>
              <td class="shaded" style="width:23%;border-right:1px solid #888;padding:8px 10px;">Total Project Value (₦)</td>
              <td style="width:11%;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_total_project_value)}</td>
              <td class="shaded" style="width:22%;border-right:1px solid #888;padding:8px 10px;">Variance vs Target (₦)</td>
              <td style="width:11%;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_variance_against_target)}</td>
              <td class="shaded" style="padding:8px 10px;">Net Indicator</td>
              <td style="padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_net_indicator)}</td>
            </tr>
            <tr>
              <td class="shaded" style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;">Leads Generated</td>
              <td style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_leads_generated)}</td>
              <td class="shaded" style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;">Proposals Sent</td>
              <td style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_proposals_sent)}</td>
              <td class="shaded" style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;">Total Pending Deals</td>
              <td style="border-top:1px solid #888;border-right:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_total_pending_deals)}</td>
              <td class="shaded" style="border-top:1px solid #888;padding:8px 10px;">Completed Projects</td>
              <td style="border-top:1px solid #888;padding:8px 10px;text-align:center;font-weight:600;color:#0369a1;">${safe(report.sales_perf_total_completed_projects)}</td>
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

        ${
          report.invoice_number || invoiceItems.length > 0
            ? `
        <div style="margin-top:20px; border-radius:10px; overflow:hidden; border:1px solid #e6a817;">
          <div class="invoice-header">
            <span>🏢</span>
            <span>INVOICE / RECEIPT SECTION — iBrand Africa LTD</span>
          </div>
          <div style="padding:20px;">
            <div class="invoice-company">
              <div>iBrand Africa LTD</div>
              <div style="font-size:12px;">
                <div><strong>Address:</strong> ${safe(report.invoice_company_address || "House 5, 5th Street, Elekahia Housing Estate, Port Harcourt.")}</div>
                <div style="margin-top:4px;"><strong>Phone:</strong> ${safe(report.invoice_company_phone || "0802-126-0000")} &nbsp;&nbsp; <strong>Fax:</strong> ${safe(report.invoice_company_fax || "0803-747-8593")}</div>
                <div style="margin-top:4px;"><strong>Email:</strong> ${safe(report.invoice_company_email || "info@ibrand...")} &nbsp;&nbsp; <strong>Website:</strong> ${safe(report.invoice_company_website || "www.ibrand...")}</div>
              </div>
            </div>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:16px;">
              <div>
                <div style="font-size:13px; color:#555; margin-bottom:6px; font-weight:600;">Bill To:</div>
                <div style="font-weight:600;">${safe(report.invoice_bill_to_name || "The Management")}</div>
                <div style="font-size:12px; margin-top:4px; color:#444;">${safe(report.invoice_bill_to_address)}</div>
                <div style="font-size:12px; margin-top:4px;">${safe(report.invoice_bill_to_email)}</div>
                <div style="font-size:12px; margin-top:2px; font-weight:600;">${safe(report.invoice_bill_to_phone)}</div>
              </div>
              <div style="text-align:right; font-size:12px;">
                <div><strong>Invoice #:</strong> ${safe(report.invoice_number)}</div>
                <div style="margin-top:4px;"><strong>Invoice Date:</strong> ${safe(report.invoice_date)}</div>
              </div>
            </div>

            <table style="border-top:3px solid #e6a817; border-bottom:3px solid #e6a817;">
              <thead>
                <tr style="background:#fff8e8; border-bottom:2px solid #e6a817;">
                  <th style="padding:10px 12px; text-align:left;">Item</th>
                  <th style="padding:10px 12px; text-align:right; width:180px;">Total Cost (₦)</th>
                </tr>
              </thead>
              <tbody>
                ${invoiceRows}
                <tr style="border-top:3px solid #e6a817;">
                  <td style="padding:12px 12px; text-align:right; font-weight:700; font-size:16px;">Total</td>
                  <td style="padding:12px 12px; text-align:right; font-weight:900; font-size:20px; text-decoration:underline; text-underline-offset:4px;">${safe(report.invoice_total)}</td>
                </tr>
              </tbody>
            </table>

            <div style="margin-top:16px; font-size:12px;">
              <div style="font-weight:700; text-transform:uppercase; color:#555; margin-bottom:8px;">All Checks Payable to iBrand Africa LTD</div>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px;">
                <div><strong>Account Name:</strong> ${safe(report.invoice_bank_account_name || "iBrand Africa Ltd")}</div>
                <div><strong>Account Number:</strong> ${safe(report.invoice_bank_account_number || "5600779289")}</div>
                <div><strong>Bank Name:</strong> ${safe(report.invoice_bank_name || "Fidelity Bank PLC")}</div>
              </div>
            </div>

            ${
              report.invoice_footer_note
                ? `
            <div style="margin-top:14px; padding-top:12px; border-top:1px solid #eee; color:#dc2626; font-size:11px; font-weight:600;">
              <strong style="text-transform:uppercase;">Note:</strong>
              <span style="color:#1f2937; font-weight:400; line-height:1.5;">${safe(report.invoice_footer_note)}</span>
            </div>`
                : ""
            }
          </div>
        </div>`
            : ""
        }

        ${
          report.report_link
            ? `
          <div style="margin-top:16px; padding:14px; border:1px solid #0ea5e9; background:#f0f9ff; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;color:#0369a1;">🔗 Reference Link</div>
            <a class="link" href="${safe(report.report_link)}" target="_blank" rel="noopener">
              🔗 ${safe(report.report_link_label || report.report_link)}
            </a>
          </div>`
            : ""
        }

        ${
          report.attached_file_name
            ? `
          <div style="margin-top:10px; padding:14px; border:1px solid #cbd5e1; background:#f8fafc; border-radius:10px;">
            <div style="font-weight:600;margin-bottom:6px;">📎 Attached File</div>
            <a class="link" href="${safe(report.attached_file!)}" download="${safe(report.attached_file_name!)}" style="border-color:#94a3b8;background:#f8fafc;color:#334155;">
              📎 ${safe(report.attached_file_name)}
            </a>
          </div>`
            : ""
        }

        <div class="foot" style="margin-top:22px;padding-top:10px;border-top:1px solid #e2e8f0;text-align:center;color:#94a3b8;font-size:10px;">
          iBrand Africa — CSR / Sales Weekly Performance Report Form · Generated ${new Date().toLocaleString()}
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

  const ROW_RATINGS: ReadonlyArray<{ value: string; label: string }> = [
    { value: "excellent", label: "Excellent" },
    { value: "good", label: "Good" },
    { value: "fair", label: "Fair" },
    { value: "sum_optimal", label: "Sum-optimal" },
    { value: "poor", label: "Poor" },
  ];

  async function submit() {
    if (!user) return;
    // Auto-generate a sensible title if user hasn't set one
    const autoTitle =
      draft.report_employee_name && draft.report_week_ending
        ? `Weekly Report — ${draft.report_employee_name} · Week Ending ${draft.report_week_ending}`
        : draft.report_employee_name
          ? `Performance Report — ${draft.report_employee_name}`
          : `Report: ${formatDate(draft.report_date ?? new Date().toISOString().slice(0, 10))}`;
    const finalTitle =
      draft.title?.trim() ||
      (draft.attached_file_name ? `Report: ${draft.attached_file_name}` : autoTitle);
    const id = await saveReport({
      ...(draft as Report),
      title: finalTitle,
      author_id: draft.author_id ?? user.id,
      department_id: draft.department_id ?? profile?.department_id ?? null,
    });
    await broadcast({
      departmentId: profile?.department_id ?? null,
      title: "New report submitted",
      body: `${profile?.full_name ?? "Employee"} submitted: "${finalTitle}"`,
      actorId: user.id,
      type: "report",
    });
    await track({
      actorId: user.id,
      actorName: profile?.full_name ?? "Someone",
      action: "submitted a report",
      entityType: "report",
      entityId: id,
      detail: `${profile?.full_name ?? "Someone"} submitted "${finalTitle}"`,
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
          isAdmin
            ? "Every report submitted across the company."
            : isDeptAdmin
              ? "Reports from your department."
              : "Your daily, weekly and monthly reports."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {filtered.length > 0 && (canManage || isAdmin || isDeptAdmin) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportAllReports(filtered)}
                disabled={exporting}
                className="gap-1.5 h-9"
              >
                <Download className="size-4" />
                {exporting ? "Exporting…" : `Export ${filtered.length}`}
              </Button>
            )}
            <Button
              onClick={() => {
                setDraft({ ...empty });
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New report
            </Button>
          </div>
        }
      />

      {/* ── Filters ── */}
      {showFilters && (
        <div className="surface-card flex flex-wrap items-center gap-3 p-4">
          <SlidersHorizontal className="text-muted-foreground size-4 shrink-0" />
          <div className="relative flex-1 min-w-[160px]">
            <Search className="text-muted-foreground absolute left-3 top-1/2 size-4 -translate-y-1/2" />
            <Input
              className="pl-9"
              placeholder="Search reports…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {REPORT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {REPORT_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canManage && (
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canManage && (
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All employees</SelectItem>
                {allProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {(search ||
            filterType !== "all" ||
            filterStatus !== "all" ||
            filterDept !== "all" ||
            filterEmployee !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setFilterType("all");
                setFilterStatus("all");
                setFilterDept("all");
                setFilterEmployee("all");
              }}
            >
              Clear
            </Button>
          )}
          <span className="text-muted-foreground ml-auto text-xs">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title={reports.length === 0 ? "No reports yet" : "No reports match your filters"}
          description={
            reports.length === 0 ? "Submit your first daily report." : "Try adjusting the filters."
          }
          action={
            reports.length === 0 ? (
              <Button
                onClick={() => {
                  setDraft({ ...empty });
                  setOpen(true);
                }}
              >
                <Plus className="size-4" /> New report
              </Button>
            ) : undefined
          }
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
                    {/* Show a couple of iBrand structured details as preview */}
                    {(r.report_employee_name || r.report_week_ending) && (
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        {r.report_employee_name && (
                          <>
                            👤 {r.report_employee_name}
                            {r.report_week_ending && " · "}
                          </>
                        )}
                        {r.report_week_ending && <>📅 Week ending {r.report_week_ending}</>}
                      </p>
                    )}
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
                {/* Show perf summary as preview if available */}
                {r.perf_projects_received && (
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-lg bg-secondary/40 px-2.5 py-2">
                      <p className="text-muted-foreground text-[10px]">Received</p>
                      <p className="font-semibold">{r.perf_projects_received}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-2.5 py-2">
                      <p className="text-muted-foreground text-[10px]">Delivered</p>
                      <p className="font-semibold">{r.perf_projects_delivered || "0"}</p>
                    </div>
                    <div className="rounded-lg bg-secondary/40 px-2.5 py-2">
                      <p className="text-muted-foreground text-[10px]">On-going</p>
                      <p className="font-semibold">{r.perf_projects_ongoing || "0"}</p>
                    </div>
                  </div>
                )}
                {r.completed_work && !r.perf_projects_received && (
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
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {r.attached_file_name}
                    </span>
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
                      onClick={() => {
                        setDraft(r);
                        setOpen(true);
                      }}
                    >
                      Open / Edit
                    </Button>
                  )}
                  {/* Anyone who can read the full report gets a Preview button */}
                  {canReadFull && (
                    <Button
                      size="sm"
                      variant={isOwner ? "ghost" : "outline"}
                      onClick={() => {
                        setViewReport(r);
                        setViewOpen(true);
                      }}
                    >
                      <Eye className="size-4" /> {isOwner ? "Preview" : "Read report"}
                    </Button>
                  )}
                  {canReadFull && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1.5 text-primary hover:text-primary hover:bg-primary/5"
                      onClick={() => {
                        if (r.is_sales_report) {
                          exportSalesReport(r);
                        } else {
                          exportReport(r);
                        }
                      }}
                    >
                      <Download className="size-4" /> Export
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          NEW / EDIT REPORT DIALOG — uses iBrand template (editable)
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[98vh] overflow-y-auto sm:max-w-[98vw] lg:max-w-[1600px] p-0">
          <div className="sticky top-0 z-20 border-b bg-background px-6 py-3.5 flex items-start justify-between gap-3">
            <DialogHeader>
              <DialogTitle>
                {draft.id
                  ? "Edit Report"
                  : draft.is_sales_report
                    ? "New CSR / Sales Weekly Performance Report"
                    : "New Weekly Performance Report"}
              </DialogTitle>
              <p className="text-muted-foreground text-xs mt-1">
                Fill in the iBrand Africa form below. Upload file and Reference link sections appear
                at the end.
              </p>
            </DialogHeader>
            {/* Report type selector — kept as requested */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Report type</Label>
                <Select
                  value={draft.report_type ?? "daily"}
                  onValueChange={(v) => setDraft({ ...draft, report_type: v })}
                >
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="px-6 py-5">
            {/* Subtle meta: report_date (kept for internal tracking) */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs shrink-0">Report date</Label>
                <Input
                  type="date"
                  className="w-[170px] h-9 text-xs"
                  value={draft.report_date ?? ""}
                  onChange={(e) => setDraft({ ...draft, report_date: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <Label className="text-xs shrink-0">Report title (auto)</Label>
                <Input
                  className="h-9 text-xs"
                  value={draft.title ?? ""}
                  placeholder="Leave blank to auto-generate from name + week ending"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
            </div>

            {draft.is_sales_report ? (
              <SalesPerformanceReport
                readOnly={false}
                data={draft}
                onChange={(updates) => setDraft((prev) => ({ ...prev, ...updates }))}
                uploadingFile={uploadingFile}
                onFileSelect={handleReportFileChange}
                onRemoveFile={() =>
                  setDraft((d) => ({ ...d, attached_file: null, attached_file_name: null }))
                }
                fileInputRef={fileInputRef}
              />
            ) : (
              <WeeklyPerformanceReport
                readOnly={false}
                data={draft}
                onChange={(updates) => setDraft((prev) => ({ ...prev, ...updates }))}
                uploadingFile={uploadingFile}
                onFileSelect={handleReportFileChange}
                onRemoveFile={() =>
                  setDraft((d) => ({ ...d, attached_file: null, attached_file_name: null }))
                }
                fileInputRef={fileInputRef}
              />
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={
                draft.is_sales_report
                  ? !!(
                      draft.sales_projects &&
                      draft.sales_projects.length === 0 &&
                      !draft.attached_file
                    )
                  : !!(
                      draft.report_projects &&
                      draft.report_projects.length === 0 &&
                      !draft.attached_file
                    )
              }
            >
              {draft.id ? "Save changes" : "Submit report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════════════
          READ-ONLY VIEW (admins / preview) — uses SAME template
          ═══════════════════════════════════════════════════════════ */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[98vh] overflow-y-auto sm:max-w-[98vw] lg:max-w-[1600px] p-0">
          {viewReport && (
            <>
              <div className="sticky top-0 z-20 border-b bg-background px-6 py-3.5 flex flex-wrap items-start justify-between gap-3">
                <DialogHeader>
                  <DialogTitle className="text-lg">{viewReport.title}</DialogTitle>
                  <p className="text-muted-foreground text-xs mt-1">
                    {labelOf(REPORT_TYPES, viewReport.report_type)} ·{" "}
                    {formatDate(viewReport.report_date)} ·{" "}
                    {allProfiles.find((p) => p.id === viewReport.author_id)?.full_name ?? "Unknown"}{" "}
                    ·{" "}
                    {departments.find((d) => d.id === viewReport.department_id)?.name ?? "No dept"}
                  </p>
                </DialogHeader>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9"
                    onClick={() => {
                      if (viewReport.is_sales_report) {
                        exportSalesReport(viewReport);
                      } else {
                        exportReport(viewReport);
                      }
                    }}
                  >
                    <Download className="size-4" /> Export PDF
                  </Button>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 h-9"
                      onClick={async () => {
                        await handleDelete(viewReport);
                        setViewOpen(false);
                        setViewReport(null);
                      }}
                    >
                      <Trash2 className="size-4" /> Delete
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={() => setViewOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="px-6 py-5">
                {viewReport.is_sales_report ? (
                  <SalesPerformanceReport readOnly={true} data={viewReport} />
                ) : (
                  <WeeklyPerformanceReport readOnly={true} data={viewReport} />
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
