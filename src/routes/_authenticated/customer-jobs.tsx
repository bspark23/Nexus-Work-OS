import { useState, useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Briefcase, Plus, Trash2, Upload, CheckCircle2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useMyDepartment, useCustomerJobs, useJobDepartments, useDepartments, useSavedFile } from "@/hooks/useData";
import { createCustomerJob, deleteCustomerJob, updateCustomerJob } from "@/lib/jobs-api";
import { JOB_STATUSES, labelOf, toneOf } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { parseJobFile } from "@/lib/job-parse";
import { mapPairsToJob } from "@/lib/job-parse";
import type { CustomerJob } from "@/lib/types";
import type { ExtractedJob } from "@/lib/job-parse";
import { broadcast } from "@/lib/notify";

export const Route = createFileRoute("/_authenticated/customer-jobs")({
  head: () => ({
    meta: [
      { title: "Customer Jobs — Nexus Work OS" },
      { name: "description", content: "Upload and manage customer job requests for all departments." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    fromFile: s["fromFile"] as string | undefined,
    fileId: s["fileId"] as string | undefined,
  }),
  component: CustomerJobsPage,
});

const emptyJob: ExtractedJob = {
  customer_name: "",
  company_name: "",
  contact_info: "",
  project_title: "",
  project_description: "",
  requested_services: "",
  expected_delivery_date: "",
  notes: "",
};

function CustomerJobsPage() {
  const { user, profile, isAdmin, isDeptAdmin } = useAuth();
  const { isSales } = useMyDepartment();
  const { fromFile, fileId } = Route.useSearch();
  const { data: jobs = [] } = useCustomerJobs();
  const { data: jobDepts = [] } = useJobDepartments();
  const { data: departments = [] } = useDepartments();
  // Load own file OR a specific file by ID (when admin picks someone else's file)
  const { data: ownFile } = useSavedFile(user?.id ?? null);
  const savedFile = ownFile; // will be replaced by fileId fetch if needed
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editJob, setEditJob] = useState<CustomerJob | null>(null);
  const [form, setForm] = useState<ExtractedJob>(emptyJob);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // Gate: only Sales employees, dept admins, and super admins
  const canAccess = isAdmin || isDeptAdmin || isSales;

  // Auto-open with saved file data when navigated from File Workspace
  useEffect(() => {
    if (!open && fromFile) {
      // Read the file data passed via sessionStorage from File Workspace
      const stored = sessionStorage.getItem("prefill_job_file");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { file_name: string; rows: Record<string, string>[]; columns: string[] };
          sessionStorage.removeItem("prefill_job_file"); // clear after reading
          const row = parsed.rows[0];
          if (row) {
            const pairs: [string, string][] = Object.entries(row).map(([k, v]) => [k, String(v ?? "")]);
            const extracted = mapPairsToJob(pairs);
            setForm(extracted);
            setEditJob(null);
            setSelectedDepts([]);
            setOpen(true);
            toast.info(`Form pre-filled from "${parsed.file_name}" — review and submit`);
          }
        } catch {
          toast.error("Could not read file data");
        }
      } else if (savedFile && savedFile.rows.length > 0) {
        // Fallback: use own saved file
        const row = savedFile.rows[0];
        if (row) {
          const pairs: [string, string][] = Object.entries(row).map(([k, v]) => [k, String(v ?? "")]);
          setForm(mapPairsToJob(pairs));
          setEditJob(null);
          setSelectedDepts([]);
          setOpen(true);
          toast.info(`Form pre-filled from "${savedFile.file_name}"`);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromFile]);

  if (!canAccess) {
    return (
      <div className="text-muted-foreground flex h-60 flex-col items-center justify-center gap-2 text-sm">
        <Briefcase className="size-8 opacity-30" />
        <p>This page is only available to Sales department employees and admins.</p>
      </div>
    );
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files?.[0]) return;
    setUploading(true);
    try {
      const parsed = await parseJobFile(files[0]);
      setForm(parsed.job);
      toast.success("File parsed — review and submit");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not parse file");
    } finally {
      setUploading(false);
    }
  }

  function openNew() {
    setEditJob(null);
    setForm(emptyJob);
    setSelectedDepts([]);
    setOpen(true);
  }

  function openEdit(job: CustomerJob) {
    setEditJob(job);
    setForm({
      customer_name: job.customer_name,
      company_name: job.company_name ?? "",
      contact_info: job.contact_info ?? "",
      project_title: job.project_title,
      project_description: job.project_description ?? "",
      requested_services: job.requested_services ?? "",
      expected_delivery_date: job.expected_delivery_date ?? "",
      notes: job.notes ?? "",
    });
    const linked = jobDepts.filter((jd) => jd.job_id === job.id).map((jd) => jd.department_id);
    setSelectedDepts(linked);
    setOpen(true);
  }

  async function submit() {
    if (!form.customer_name || !form.project_title || !user) return;
    try {
      if (editJob) {
        await updateCustomerJob(editJob.id, {
          customer_name: form.customer_name,
          company_name: form.company_name || null,
          contact_info: form.contact_info || null,
          project_title: form.project_title,
          project_description: form.project_description || null,
          requested_services: form.requested_services || null,
          expected_delivery_date: form.expected_delivery_date || null,
          notes: form.notes || null,
        });
        toast.success("Job updated");
      } else {
        const jobId = await createCustomerJob(
          {
            created_by: user.uid,
            customer_name: form.customer_name,
            company_name: form.company_name || null,
            contact_info: form.contact_info || null,
            project_title: form.project_title,
            project_description: form.project_description || null,
            requested_services: form.requested_services || null,
            expected_delivery_date: form.expected_delivery_date || null,
            notes: form.notes || null,
            status: "submitted",
          },
          selectedDepts,
        );

        // Notify each selected department
        for (const deptId of selectedDepts) {
          await broadcast({
            departmentId: deptId,
            title: "New customer job received",
            body: `${form.project_title} from ${form.customer_name}`,
            actorId: user.uid,
            type: "job",
          });
        }

        toast.success("Customer job submitted");
      }

      setOpen(false);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  function toggleDept(id: string) {
    setSelectedDepts((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id],
    );
  }

  return (
    <>
      <PageHeader
        title="Customer Jobs"
        subtitle="Upload customer job files, review extracted info and assign to departments."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/file-workspace" search={{ fromJob: undefined }}>
              <Button variant="outline" size="sm">
                <FileSpreadsheet className="size-4" /> File Workspace
              </Button>
            </Link>
            {(isAdmin || isDeptAdmin || isSales) && (
              <Button onClick={openNew}>
                <Plus className="size-4" /> New job
              </Button>
            )}
          </div>
        }
      />

      {jobs.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-6" />}
          title="No customer jobs yet"
          description="Upload an Excel, CSV or PDF file with customer details to create a job request."
          action={<Button onClick={openNew}><Plus className="size-4" /> New job</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {jobs.map((j) => {
            const deptCount = jobDepts.filter((jd) => jd.job_id === j.id).length;
            return (
              <article key={j.id} className="surface-card animate-rise flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{j.project_title}</h2>
                    <p className="text-muted-foreground text-xs">{j.customer_name}</p>
                  </div>
                  <StatusBadge
                    label={labelOf(JOB_STATUSES, j.status)}
                    tone={toneOf(JOB_STATUSES, j.status)}
                  />
                </div>
                {j.project_description && (
                  <p className="text-muted-foreground line-clamp-2 text-sm">{j.project_description}</p>
                )}
                <div className="text-muted-foreground flex items-center justify-between text-xs">
                  <span>{deptCount} department{deptCount !== 1 ? "s" : ""} assigned</span>
                  <span>Due {formatDate(j.expected_delivery_date)}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(j)}>
                    View / Edit
                  </Button>
                  {(isAdmin || j.created_by === user?.uid) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        await deleteCustomerJob(j.id);
                        toast.success("Job deleted");
                        qc.invalidateQueries();
                      }}
                    >
                      <Trash2 className="text-destructive size-4" />
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editJob ? "Customer Job" : "New Customer Job"}</DialogTitle>
          </DialogHeader>

          {!editJob && (
            <div className="rounded-xl border border-dashed p-4 space-y-3">
              <p className="text-muted-foreground text-sm text-center">Auto-fill the form from a file</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {savedFile && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const row = savedFile.rows[0];
                      if (row) {
                        const pairs: [string, string][] = Object.entries(row).map(([k, v]) => [k, String(v ?? "")]);
                        setForm(mapPairsToJob(pairs));
                        toast.success(`Pre-filled from "${savedFile.file_name}"`);
                      } else {
                        toast.error("Saved file has no rows");
                      }
                    }}
                  >
                    <FileSpreadsheet className="size-4" />
                    Use saved file ({savedFile.file_name})
                  </Button>
                )}
                <label className="cursor-pointer">
                  <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                    <span>
                      <Upload className="size-4" />
                      {uploading ? "Parsing…" : "Upload new file"}
                    </span>
                  </Button>
                  <input
                    type="file"
                    hidden
                    accept=".xlsx,.xls,.csv,.pdf"
                    onChange={(e) => handleFileUpload(e.target.files)}
                  />
                </label>
                {!savedFile && (
                  <Link to="/file-workspace" search={{ fromJob: undefined }}>
                    <Button type="button" variant="ghost" size="sm">
                      <ExternalLink className="size-4" /> Open File Workspace
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Customer name *</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Company name</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Contact info</Label>
              <Input
                value={form.contact_info}
                onChange={(e) => setForm({ ...form, contact_info: e.target.value })}
                placeholder="Email / Phone"
              />
            </div>
            <div className="space-y-2">
              <Label>Expected delivery</Label>
              <Input
                type="date"
                value={form.expected_delivery_date}
                onChange={(e) => setForm({ ...form, expected_delivery_date: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Project title *</Label>
              <Input
                value={form.project_title}
                onChange={(e) => setForm({ ...form, project_title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Project description</Label>
              <Textarea
                rows={3}
                value={form.project_description}
                onChange={(e) => setForm({ ...form, project_description: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Requested services</Label>
              <Input
                value={form.requested_services}
                onChange={(e) => setForm({ ...form, requested_services: e.target.value })}
                placeholder="Web design, video editing, social media…"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          {!editJob && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Assign to departments</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {departments.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded-lg border p-2.5">
                    <Checkbox
                      checked={selectedDepts.includes(d.id)}
                      onCheckedChange={() => toggleDept(d.id)}
                    />
                    <span className="text-sm">{d.name}</span>
                    {selectedDepts.includes(d.id) && (
                      <CheckCircle2 className="text-success ml-auto size-4" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!form.customer_name || !form.project_title}>
              {editJob ? "Save changes" : "Submit job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

