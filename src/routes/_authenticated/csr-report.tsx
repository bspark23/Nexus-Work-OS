import { useState, useMemo, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Eye,
  Download,
  Paperclip,
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
import { useMyDepartment, useReports, useProfiles, useDepartments } from "@/hooks/useData";
import { saveReport, deleteReport, track } from "@/lib/api";
import { broadcast } from "@/lib/notify";
import { REPORT_STATUSES, REPORT_TYPES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { SalesPerformanceReport } from "@/components/common/SalesPerformanceReport";
import type { Report, SalesProjectRow, SalesInvoiceItem } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/csr-report")({
  head: () => ({
    meta: [
      { title: "CSR Report — Nexus Work OS" },
      { name: "description", content: "Submit and review sales/CSR performance reports." },
    ],
  }),
  component: CSRReportPage,
});

const MAX_REPORT_FILE = 900 * 1024;

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

const emptyCSR: Partial<Report> = {
  title: "",
  report_type: "weekly",
  status: "submitted",
  report_date: new Date().toISOString().slice(0, 10),
  attached_file: null,
  attached_file_name: null,
  report_link: null,
  report_link_label: null,
  report_banner_line1: "CSR WEEKLY",
  report_banner_line2: "PERFORMANCE",
  report_banner_line3: "REPORT FORM",
  report_employee_name: null,
  report_designation: "CSR / Sales Executive",
  report_week_ending: new Date().toISOString().slice(0, 10),
  report_supervisor: null,
  sales_projects: defaultSalesProjects,
  sales_perf_number_of_projects: "",
  sales_perf_total_project_value: "",
  sales_perf_variance_against_target: "",
  sales_perf_net_indicator: "",
  sales_perf_leads_generated: "",
  sales_perf_proposals_sent: "",
  sales_perf_total_pending_deals: "",
  sales_perf_total_completed_projects: "",
  self_eval_rating: null,
  self_eval_strategies: null,
  self_eval_improvement: null,
  self_eval_upcoming: null,
  self_eval_challenges: null,
  supervisor_remark: null,
  supervisor_sign_date: null,
  is_sales_report: true,
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
  invoice_footer_note: "All payments should be made to accounts bearing iBrand Africa. Any payment made to accounts with another name will not be acknowledged.",
};

function CSRReportPage() {
  const { user, profile, isAdmin, isDeptAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const qc = useQueryClient();

  const { data: allReports = [] } = useReports();
  const { data: allProfiles = [] } = useProfiles(isAdmin || isDeptAdmin);
  const { data: departments = [] } = useDepartments();

  // Filters
  const [search, setSearch] = useState("");
  const [filterEmployee, setFilterEmployee] = useState("all");

  // Dialogs
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Report>>(emptyCSR);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  if (!isSales && !isAdmin && !isDeptAdmin) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <FileText className="size-12 text-muted-foreground/20" />
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground text-sm max-w-xs">
            Only the Sales Team and Administrators can access the CSR Report page.
          </p>
        </div>
      </div>
    );
  }

  // Filter reports: only CSR/Sales reports
  const csrReports = useMemo(() => {
    return allReports.filter((r) => r.is_sales_report);
  }, [allReports]);

  // Scope: Sales see their own, Admins see all
  const scopedReports = useMemo(() => {
    if (isAdmin) return csrReports;
    if (isDeptAdmin) {
       // Dept admins see their department's sales reports
       return csrReports.filter(r => r.department_id === profile?.department_id);
    }
    return csrReports.filter((r) => r.author_id === user?.id);
  }, [csrReports, isAdmin, isDeptAdmin, user, profile]);

  const filtered = useMemo(() => {
    return scopedReports.filter((r) => {
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterEmployee !== "all" && r.author_id !== filterEmployee) return false;
      return true;
    });
  }, [scopedReports, search, filterEmployee]);

  async function handleReportFileChange(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (file.size > MAX_REPORT_FILE) {
      toast.error(`File too large. Max 900 KB.`);
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

  async function submit() {
    if (!user) return;
    const autoTitle = `CSR Weekly Report — ${draft.report_employee_name || profile?.full_name} · Week Ending ${draft.report_week_ending}`;
    const finalTitle = draft.title?.trim() || autoTitle;
    
    const id = await saveReport({
      ...(draft as Report),
      title: finalTitle,
      author_id: draft.author_id ?? user.id,
      department_id: draft.department_id ?? profile?.department_id ?? null,
      is_sales_report: true,
    });

    await broadcast({
      departmentId: profile?.department_id ?? null,
      title: "New CSR report submitted",
      body: `${profile?.full_name ?? "Sales Team Member"} submitted a CSR report`,
      actorId: user.id,
      type: "report",
    });

    await track({
      actorId: user.id,
      actorName: profile?.full_name ?? "Sales Team Member",
      action: "submitted a CSR report",
      entityType: "report",
      entityId: id,
      detail: `${profile?.full_name} submitted CSR report: "${finalTitle}"`,
      type: "report",
    });

    toast.success("CSR Report submitted");
    setOpen(false);
    setDraft(emptyCSR);
    qc.invalidateQueries();
  }

  async function handleDelete(r: Report) {
    if (!confirm(`Delete report "${r.title}"?`)) return;
    await deleteReport(r.id);
    toast.success("Report deleted");
    qc.invalidateQueries();
  }

  return (
    <>
      <PageHeader
        title="CSR Performance Reports"
        subtitle="Weekly sales performance tracking and revenue reporting."
        actions={
          (isSales || isAdmin) && (
            <Button
              onClick={() => {
                setDraft({ 
                  ...emptyCSR, 
                  report_employee_name: profile?.full_name,
                  report_supervisor: departments.find(d => d.id === profile?.department_id)?.name || ""
                });
                setOpen(true);
              }}
            >
              <Plus className="size-4" /> New CSR Report
            </Button>
          )
        }
      />

      <div className="surface-card flex flex-wrap items-center gap-3 p-4">
        <Search className="text-muted-foreground size-4" />
        <Input
          className="max-w-xs"
          placeholder="Search reports…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {(isAdmin || isDeptAdmin) && (
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All employees" />
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
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="size-6" />}
          title="No CSR reports found"
          description="Reports submitted by the sales team will appear here."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((r) => {
            const author = allProfiles.find((p) => p.id === r.author_id);
            return (
              <article key={r.id} className="surface-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{r.title}</h2>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(r.report_date)} {author && ` · ${author.full_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge
                      label={labelOf(REPORT_STATUSES, r.status)}
                      tone={toneOf(REPORT_STATUSES, r.status)}
                    />
                    {(r.author_id === user?.id || isAdmin) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() => handleDelete(r)}
                      >
                        <Trash2 className="text-destructive size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg bg-secondary/40 px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">Projects</p>
                    <p className="font-semibold">{r.sales_perf_number_of_projects || "0"}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/40 px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">Total Value</p>
                    <p className="font-semibold">₦{r.sales_perf_total_project_value || "0"}</p>
                  </div>
                </div>

                {/* Show attached file and link */}
                {(r.attached_file_name || r.report_link) && (
                  <div className="space-y-2">
                    {r.attached_file_name && (
                      <div className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                        <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                        <span className="flex-1 truncate font-medium">{r.attached_file_name}</span>
                        {r.attached_file && (
                          <a
                            href={r.attached_file}
                            download={r.attached_file_name}
                            className="text-primary hover:underline"
                          >
                            <Download className="size-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                    {r.report_link && (
                      <div className="flex items-center gap-2 rounded-lg bg-secondary/30 px-3 py-2 text-xs">
                        <Link2 className="size-3.5 shrink-0 text-muted-foreground" />
                        <a
                          href={r.report_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 truncate text-primary hover:underline"
                        >
                          {r.report_link_label || r.report_link}
                        </a>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setViewReport(r);
                      setViewOpen(true);
                    }}
                  >
                    <Eye className="size-4" /> View Full Report
                  </Button>
                  {r.author_id === user?.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDraft(r);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Submission Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl p-0">
          <div className="sticky top-0 z-20 border-b bg-background px-6 py-4">
            <DialogHeader>
              <DialogTitle>
                {draft.id ? "Edit CSR Report" : "New CSR Weekly Performance Report"}
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 py-5">
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
          </div>
          <DialogFooter className="px-6 py-4 border-t sticky bottom-0 bg-background">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>
              {draft.id ? "Save Changes" : "Submit CSR Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-5xl p-0">
          {viewReport && (
            <>
              <div className="sticky top-0 z-20 border-b bg-background px-6 py-4 flex items-center justify-between">
                <DialogHeader>
                  <DialogTitle>{viewReport.title}</DialogTitle>
                </DialogHeader>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const reportElement = document.getElementById('sales-performance-report');
                      if (reportElement) {
                        const printWindow = window.open('', '_blank');
                        if (printWindow) {
                          printWindow.document.write(`
                            <html>
                              <head>
                                <title>${viewReport.title}</title>
                                <style>
                                  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
                                  @media print { body { margin: 0; padding: 0; } }
                                </style>
                              </head>
                              <body>${reportElement.innerHTML}</body>
                            </html>
                          `);
                          printWindow.document.close();
                          setTimeout(() => {
                            printWindow.print();
                          }, 250);
                        }
                      }
                    }}
                  >
                    <Download className="size-4 mr-1" /> Export PDF
                  </Button>
                  <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
                </div>
              </div>
              <div className="px-6 py-5">
                <SalesPerformanceReport readOnly={true} data={viewReport} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
