import { useRef } from "react";
import { Upload, Paperclip, Link2, ExternalLink, Download, Plus, Trash2, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Report, ReportProjectRow } from "@/lib/types";

const EMPTY_PROJECT_ROW: ReportProjectRow = {
  s_no: "", brand_name: "", project_type: "",
  date_received: "", received_from: "", time_received: "",
  date_delivered: "", delivered_to: "", time_delivered: "",
};

const RATING_OPTIONS = [
  { value: "excellent", label: "Excellent" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "sum_optimal", label: "Sum-optimal" },
  { value: "poor", label: "Poor" },
] as const;

type Props = {
  readOnly?: boolean;
  data: Partial<Report>;
  onChange?: (updates: Partial<Report>) => void;
  uploadingFile?: boolean;
  onFileSelect?: (files: FileList | null) => void;
  onRemoveFile?: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;
  hideReportType?: boolean;
  reportTypeLabel?: React.ReactNode;
};

// ── Helper: cell is either an Input (editable) or plain div (readOnly) ──────
function Cell({
  value,
  onChange,
  placeholder,
  readOnly,
  className = "",
  textarea = false,
  type,
}: {
  value: string | number | null | undefined;
  onChange?: (v: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  textarea?: boolean;
  type?: string;
}) {
  if (readOnly) {
    const v = value ?? "";
    return (
      <div
        className={`px-2 py-1.5 min-h-[34px] text-xs flex items-center ${
          v ? "" : "text-muted-foreground/30"
        } ${className}`}
      >
        {v || (placeholder ? <span className="italic">{placeholder}</span> : <>&nbsp;</>)}
      </div>
    );
  }
  if (textarea) {
    return (
      <Textarea
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={`min-h-[34px] !py-1.5 text-xs border-0 focus-visible:ring-1 focus-visible:ring-primary/60 resize-y rounded-none ${className}`}
      />
    );
  }
  return (
    <Input
      type={type ?? "text"}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-[34px] text-xs border-0 focus-visible:ring-1 focus-visible:ring-primary/60 rounded-none ${className}`}
    />
  );
}

export function WeeklyPerformanceReport({
  readOnly = false,
  data,
  onChange,
  uploadingFile = false,
  onFileSelect,
  onRemoveFile,
  fileInputRef,
}: Props) {
  const localFileRef = useRef<HTMLInputElement>(null);
  const inputRef = fileInputRef ?? localFileRef;

  const set = (updates: Partial<Report>) => {
    if (!readOnly) onChange?.(updates);
  };

  // ── Projects table helpers ────────────────────────────────────────────────
  const projects = data.report_projects ?? [];
  const ensureRows = (n: number): ReportProjectRow[] => {
    const rows = [...projects];
    while (rows.length < n) rows.push({ ...EMPTY_PROJECT_ROW });
    return rows;
  };
  const updateProject = (idx: number, patch: Partial<ReportProjectRow>) => {
    const rows = ensureRows(idx + 1);
    rows[idx] = { ...rows[idx], ...patch };
    set({ report_projects: rows });
  };
  const addProject = () => {
    const rows = [...projects];
    rows.push({ ...EMPTY_PROJECT_ROW, s_no: String(rows.length + 1) });
    set({ report_projects: rows });
  };
  const removeProject = (idx: number) => {
    const rows = projects.filter((_, i) => i !== idx);
    set({ report_projects: rows });
  };

  // Always render at least 12 project rows (as per the sample image) even when empty
  const displayProjectCount = Math.max(12, projects.length);
  const displayProjects = ensureRows(displayProjectCount);

  return (
    <div
      id="weekly-performance-report"
      className="w-full bg-white text-gray-900 font-sans"
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      {/* ═══════════════════════════════════════════════════════════
          1) HEADER BANNER — iBrand Africa logo + Title
          ═══════════════════════════════════════════════════════════ */}
      <div
        className="relative w-full overflow-hidden rounded-t-lg"
        style={{
          background:
            "linear-gradient(110deg, #c7ecf7 0%, #c7ecf7 32%, #0a1f3d 32%, #0a1f3d 75%, #2a446b 75%, #2a446b 100%)",
          minHeight: "130px",
        }}
      >
        <div className="grid grid-cols-3 items-stretch">
          {/* Logo column */}
          <div className="flex items-center justify-center py-6 px-4">
            <div className="flex flex-col items-center gap-1">
              <svg viewBox="0 0 140 120" className="h-20 w-auto" xmlns="http://www.w3.org/2000/svg">
                {/* iBrand Africa logo mark */}
                <defs>
                  <linearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0a1f3d" />
                    <stop offset="100%" stopColor="#1a3a68" />
                  </linearGradient>
                </defs>
                <path
                  d="M70 6 C35 6 6 35 6 70 C6 98 28 114 70 114 C112 114 134 98 134 70 C134 35 105 6 70 6 Z"
                  fill="url(#logoBg)"
                />
                {/* stylised iB mark */}
                <circle cx="40" cy="48" r="6" fill="#f7a03c" />
                <path
                  d="M38 60 L38 95 Q38 98 41 98 L52 98 Q55 98 55 95 L55 60 Q55 57 52 57 L41 57 Q38 57 38 60 Z M65 60 L75 60 L90 90 L75 98 L65 98 Z"
                  fill="#ffffff"
                />
                <path d="M82 60 L105 60 L105 72 L92 72 L92 78 L104 78 L104 90 L92 90 L92 98 L82 98 Z" fill="#ffffff" />
                {/* Orange dot accent */}
                <circle cx="94" cy="42" r="5" fill="#f7a03c" />
              </svg>
              <div className="text-[#0a1f3d] font-bold text-sm tracking-wide">
                iBrand <span className="text-[#f7a03c]">Africa</span>
                <span className="ml-0.5 text-[8px] align-top">™</span>
              </div>
            </div>
          </div>

          {/* Title column */}
          <div className="col-span-2 flex items-center px-6 py-6">
            <div>
              <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                DESIGNERS' WEEKLY
              </h1>
              <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                PERFORMANCE
              </h1>
              <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                REPORT FORM
              </h1>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          2) NOTE SECTION
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h2 className="text-center font-bold py-2 text-xl tracking-wider text-gray-800">
            NOTE
          </h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-base text-gray-800 leading-relaxed">
            <span className="font-bold mr-2">NOTE:</span>
            This form is designed to monitor operational output, and project progress for each team member.
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          3) INDIVIDUAL INFORMATION
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            INDIVIDUAL INFORMATION
          </h3>
        </div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr className="border-b border-gray-400">
              <td className="w-[18%] border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">Name</td>
              <td className="w-[32%] border-r border-gray-400">
                <Cell
                  value={data.report_employee_name}
                  onChange={(v) => set({ report_employee_name: v })}
                  readOnly={readOnly}
                  placeholder="Full name"
                />
              </td>
              <td className="w-[20%] border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">
                Week Ending (Date)
              </td>
              <td className="w-[30%]">
                <Cell
                  type="date"
                  value={data.report_week_ending}
                  onChange={(v) => set({ report_week_ending: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>
            <tr>
              <td className="border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">
                Designation/Role
              </td>
              <td className="border-r border-gray-400">
                <Cell
                  value={data.report_designation}
                  onChange={(v) => set({ report_designation: v })}
                  readOnly={readOnly}
                  placeholder="e.g. Graphic Designer"
                />
              </td>
              <td className="border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">
                Supervisor/Team Lead
              </td>
              <td>
                <Cell
                  value={data.report_supervisor}
                  onChange={(v) => set({ report_supervisor: v })}
                  readOnly={readOnly}
                  placeholder="Supervisor name"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          4) PROJECTS TABLE
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            PROJECTS
          </h3>
        </div>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-400 bg-gray-100">
              <th className="w-[4%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">S/No</th>
              <th className="w-[15%] border-r border-gray-400 px-1 py-1.5 text-left font-semibold">Brand Name</th>
              <th className="w-[12%] border-r border-gray-400 px-1 py-1.5 text-left font-semibold">Project Type</th>
              <th className="w-[10%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Date Received</th>
              <th className="w-[9%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Received From</th>
              <th className="w-[9%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Time Received</th>
              <th className="w-[10%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Date Delivered</th>
              <th className="w-[9%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Delivered to</th>
              <th className="w-[9%] border-r border-gray-400 px-1 py-1.5 text-center font-semibold">Time Delivered</th>
              {!readOnly && (
                <th className="w-[5%] py-1.5 text-center font-semibold">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                    title="Add project row"
                    onClick={addProject}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {displayProjects.map((row, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="border-r border-gray-300 text-center px-1 py-0.5">
                  <Cell
                    value={row.s_no || (idx + 1)}
                    onChange={(v) => updateProject(idx, { s_no: v })}
                    readOnly={readOnly}
                    className="text-center"
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    value={row.brand_name}
                    onChange={(v) => updateProject(idx, { brand_name: v })}
                    readOnly={readOnly}
                    placeholder="Brand"
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    value={row.project_type}
                    onChange={(v) => updateProject(idx, { project_type: v })}
                    readOnly={readOnly}
                    placeholder="Project"
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    type="date"
                    value={row.date_received}
                    onChange={(v) => updateProject(idx, { date_received: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    value={row.received_from}
                    onChange={(v) => updateProject(idx, { received_from: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    type="time"
                    value={row.time_received}
                    onChange={(v) => updateProject(idx, { time_received: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    type="date"
                    value={row.date_delivered}
                    onChange={(v) => updateProject(idx, { date_delivered: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    value={row.delivered_to}
                    onChange={(v) => updateProject(idx, { delivered_to: v })}
                    readOnly={readOnly}
                  />
                </td>
                <td className="border-r border-gray-300 px-0.5">
                  <Cell
                    type="time"
                    value={row.time_delivered}
                    onChange={(v) => updateProject(idx, { time_delivered: v })}
                    readOnly={readOnly}
                  />
                </td>
                {!readOnly && (
                  <td className="text-center px-0.5 py-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                      title="Remove row"
                      onClick={() => removeProject(idx)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          5) PERFORMANCE SUMMARY
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            PERFORMANCE SUMMARY
          </h3>
        </div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr className="border-b border-gray-400">
              <td className="w-[22%] border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100">
                Number of Projects Received
              </td>
              <td className="w-[11%] border-r border-gray-400 text-center">
                <Cell
                  value={data.perf_projects_received}
                  onChange={(v) => set({ perf_projects_received: v })}
                  readOnly={readOnly}
                  className="text-center justify-center font-medium text-info"
                />
              </td>
              <td className="w-[23%] border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100">
                Number of Projects Delivered
              </td>
              <td className="w-[11%] border-r border-gray-400 text-center">
                <Cell
                  value={data.perf_projects_delivered}
                  onChange={(v) => set({ perf_projects_delivered: v })}
                  readOnly={readOnly}
                  className="text-center justify-center font-medium text-info"
                />
              </td>
              <td className="w-[22%] px-3 py-2 font-semibold bg-gray-100">
                Number of Projects on-going
              </td>
              <td className="text-center">
                <Cell
                  value={data.perf_projects_ongoing}
                  onChange={(v) => set({ perf_projects_ongoing: v })}
                  readOnly={readOnly}
                  className="text-center justify-center font-medium text-info"
                />
              </td>
            </tr>
            <tr>
              <td className="border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100">
                Projects with pending feedback
              </td>
              <td className="border-r border-gray-400 text-center">
                <Cell
                  value={data.perf_pending_feedback}
                  onChange={(v) => set({ perf_pending_feedback: v })}
                  readOnly={readOnly}
                  className="text-center justify-center font-medium text-info"
                />
              </td>
              <td
                colSpan={2}
                className="border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 align-top"
              >
                Remark
              </td>
              <td colSpan={2}>
                <Cell
                  textarea
                  value={data.perf_remark}
                  onChange={(v) => set({ perf_remark: v })}
                  readOnly={readOnly}
                  placeholder="Any remarks on performance…"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          6) SELF EVALUATION
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            SELF EVALUATION
          </h3>
        </div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            {/* Rating */}
            <tr className="border-b border-gray-400">
              <td className="w-[28%] border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 align-top">
                How would you rate your performance this week?
              </td>
              <td colSpan={5}>
                {readOnly ? (
                  <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                    {RATING_OPTIONS.map((opt) => {
                      const selected = data.self_eval_rating === opt.value;
                      return (
                        <div
                          key={opt.value}
                          className={`border rounded px-3 py-1 flex items-center gap-1.5 min-w-[110px] ${
                            selected
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-gray-300 text-gray-500"
                          }`}
                        >
                          {selected && <Check className="size-3.5" />}
                          {opt.label}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 px-2 py-1.5">
                    {RATING_OPTIONS.map((opt) => {
                      const selected = data.self_eval_rating === opt.value;
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => set({ self_eval_rating: opt.value })}
                          className={`border rounded px-3 py-1 flex items-center gap-1.5 hover:border-primary/50 transition-colors min-w-[110px] ${
                            selected
                              ? "border-primary bg-primary/5 text-primary font-medium"
                              : "border-gray-300 hover:bg-gray-50"
                          }`}
                        >
                          {selected && <Check className="size-3.5" />}
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </td>
            </tr>

            {/* Strategies */}
            <tr className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-semibold bg-gray-100 align-top">
                Key Strategies that worked this week:
              </td>
              <td colSpan={5}>
                <Cell
                  textarea
                  value={data.self_eval_strategies}
                  onChange={(v) => set({ self_eval_strategies: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>

            {/* Improvement areas */}
            <tr className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-semibold bg-gray-100 align-top">
                Key areas for improvement
              </td>
              <td colSpan={5}>
                <Cell
                  textarea
                  value={data.self_eval_improvement}
                  onChange={(v) => set({ self_eval_improvement: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>

            {/* Upcoming projects */}
            <tr className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-semibold bg-gray-100 align-top">
                Upcoming projects/targets for next week
              </td>
              <td colSpan={5}>
                <Cell
                  textarea
                  value={data.self_eval_upcoming}
                  onChange={(v) => set({ self_eval_upcoming: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>

            {/* Challenges */}
            <tr className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-semibold bg-gray-100 align-top">
                Key Challenges, Impact on performance and recommendations
              </td>
              <td colSpan={5}>
                <Cell
                  textarea
                  value={data.self_eval_challenges}
                  onChange={(v) => set({ self_eval_challenges: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>

            {/* Spacer rows — as in the sample form */}
            {[0, 1, 2].map((i) => (
              <tr key={`spacer-${i}`} className="border-b border-gray-300 h-[34px]">
                <td className="border-r border-gray-300 bg-gray-100/40" />
                <td colSpan={5} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          7) SUPERVISOR'S REMARK + SIGN/DATE
          ═══════════════════════════════════════════════════════════ */}
      <div className="border-x border-t-2 border-b-2 border-gray-400 rounded-b-sm">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="w-[55%] border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100 align-top">
                Supervisor's Remark
              </td>
              <td className="w-[45%] px-3 py-1.5 font-semibold bg-gray-100 align-top">
                Supervisor's Sign/Date
              </td>
            </tr>
            <tr>
              <td className="border-r border-gray-400">
                <Cell
                  textarea
                  value={data.supervisor_remark}
                  onChange={(v) => set({ supervisor_remark: v })}
                  readOnly={readOnly}
                />
              </td>
              <td>
                <Cell
                  value={data.supervisor_sign_date}
                  onChange={(v) => set({ supervisor_sign_date: v })}
                  readOnly={readOnly}
                  placeholder="Signature / Date"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          8) REFERENCE LINK (kept as requested)
          ═══════════════════════════════════════════════════════════ */}
      <div className="mt-5 rounded-xl border border-info/20 bg-info/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-info shrink-0" />
          <p className="text-sm font-medium">
            Reference Link{" "}
            <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Add a link to your work — Google Drive, GitHub, Figma, Notion, YouTube, etc.
          Admins can click it to go directly to your deliverable.
        </p>
        {readOnly ? (
          data.report_link ? (
            <a
              href={data.report_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-info/30 bg-info/5 px-4 py-2.5 text-sm text-info hover:bg-info/10 transition-colors group font-medium"
            >
              <Link2 className="size-4 shrink-0" />
              <span className="truncate max-w-md">
                {data.report_link_label || data.report_link}
              </span>
              <ExternalLink className="size-3.5 shrink-0 opacity-60 group-hover:opacity-100" />
            </a>
          ) : (
            <div className="text-muted-foreground italic text-xs">No reference link provided</div>
          )
        ) : (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Link URL</Label>
              <Input
                type="url"
                value={data.report_link ?? ""}
                onChange={(e) => set({ report_link: e.target.value || null })}
                placeholder="https://drive.google.com/…  or  https://github.com/…"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Link label{" "}
                <span className="text-muted-foreground font-normal">
                  (what to show — leave blank to show the URL)
                </span>
              </Label>
              <Input
                value={data.report_link_label ?? ""}
                onChange={(e) => set({ report_link_label: e.target.value || null })}
                placeholder="e.g. View my design on Figma"
                className="h-9 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          9) ATTACHED FILE — kept as requested
          ═══════════════════════════════════════════════════════════ */}
      <div className="mt-4 space-y-2">
        <Label className="text-xs">
          Attach file{" "}
          <span className="text-muted-foreground font-normal">
            (optional — PDF, Word, Excel, CSV, image, max 900 KB)
          </span>
        </Label>
        {data.attached_file_name ? (
          <div className="flex items-center gap-3 rounded-xl border bg-secondary/40 px-3 py-2.5">
            <Paperclip className="text-muted-foreground size-4 shrink-0" />
            {readOnly ? (
              <a
                href={data.attached_file!}
                download={data.attached_file_name}
                className="min-w-0 flex-1 truncate text-sm font-medium text-primary hover:underline"
              >
                {data.attached_file_name}
              </a>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm">
                {data.attached_file_name}
              </span>
            )}
            <Download className="text-muted-foreground size-3.5 shrink-0" />
            {!readOnly && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive"
                onClick={onRemoveFile}
              >
                Remove
              </Button>
            )}
          </div>
        ) : readOnly ? (
          <div className="text-muted-foreground italic text-xs py-2 px-3 rounded-lg border border-dashed border-gray-300">
            No file attached to this report.
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingFile}
              onClick={() => inputRef.current?.click()}
              className="gap-1.5"
            >
              <Upload className="size-4" />
              {uploadingFile ? "Reading…" : "Upload file"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              hidden
              accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
              onChange={(e) => onFileSelect?.(e.target.files)}
            />
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          End of report
          ═══════════════════════════════════════════════════════════ */}
      <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-muted-foreground/60 text-center">
        <FileText className="size-3 inline mr-1" />
        iBrand Africa — Designers' Weekly Performance Report Form
      </div>
    </div>
  );
}
