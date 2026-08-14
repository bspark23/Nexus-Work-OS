import { useRef, useState } from "react";
import {
  Upload,
  Paperclip,
  Link2,
  ExternalLink,
  Download,
  Plus,
  Trash2,
  Check,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Report, SalesProjectRow, SalesInvoiceItem } from "@/lib/types";

const EMPTY_SALES_PROJECT_ROW: SalesProjectRow = {
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

const EMPTY_INVOICE_ITEM: SalesInvoiceItem = {
  s_no: "",
  item: "",
  total_cost: "",
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
};

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

export function SalesPerformanceReport({
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

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const [invoiceOpen, setInvoiceOpen] = useState(true);

  const set = (updates: Partial<Report>) => {
    if (!readOnly) onChange?.(updates);
  };

  const MIN_ROWS = 12;
  const rawSalesProjects = data.sales_projects ?? [];

  const padRows = (rows: SalesProjectRow[], min: number = MIN_ROWS): SalesProjectRow[] => {
    const result = [...rows];
    while (result.length < min) result.push({ ...EMPTY_SALES_PROJECT_ROW });
    return result;
  };

  const isSalesRowEmpty = (r: SalesProjectRow): boolean => {
    return !(
      r.brand_name ||
      r.contact_number ||
      r.project_type ||
      r.project_value_n ||
      r.date_confirmed ||
      r.category_location ||
      r.edo ||
      r.assigned_official
    );
  };

  const workingSalesProjects = padRows(rawSalesProjects);

  const saveSalesProjects = (rows: SalesProjectRow[]) => {
    let trimmed = [...rows];
    while (trimmed.length > MIN_ROWS && isSalesRowEmpty(trimmed[trimmed.length - 1])) {
      trimmed.pop();
    }
    set({ sales_projects: trimmed });
  };

  const updateSalesProject = (idx: number, patch: Partial<SalesProjectRow>) => {
    const rows = padRows(workingSalesProjects, Math.max(MIN_ROWS, idx + 1));
    rows[idx] = { ...rows[idx], ...patch };
    saveSalesProjects(rows);
  };

  const addSalesProject = () => {
    const rows = [...workingSalesProjects];
    rows.push({ ...EMPTY_SALES_PROJECT_ROW, s_no: String(rows.length + 1) });
    // Don't trim when adding - we want to keep the new empty row
    set({ sales_projects: rows });
  };

  const removeSalesProject = (idx: number) => {
    const rows = [...workingSalesProjects];
    if (rows.length > MIN_ROWS) {
      rows.splice(idx, 1);
      rows.forEach((r, i) => {
        r.s_no = String(i + 1);
      });
    } else {
      rows[idx] = { ...EMPTY_SALES_PROJECT_ROW, s_no: String(idx + 1) };
    }
    saveSalesProjects(rows);
  };

  const moveSalesRow = (from: number, to: number) => {
    const rows = padRows(workingSalesProjects, Math.max(MIN_ROWS, from + 1, to + 1));
    const [removed] = rows.splice(from, 1);
    rows.splice(to, 0, removed);
    rows.forEach((r, i) => {
      r.s_no = String(i + 1);
    });
    saveSalesProjects(rows);
  };

  const MIN_INVOICE_ROWS = 5;
  const rawInvoiceItems = data.invoice_items ?? [];

  const padInvoiceRows = (rows: SalesInvoiceItem[], min: number = MIN_INVOICE_ROWS): SalesInvoiceItem[] => {
    const result = [...rows];
    while (result.length < min) result.push({ ...EMPTY_INVOICE_ITEM });
    return result;
  };

  const isInvoiceItemEmpty = (r: SalesInvoiceItem): boolean => {
    return !r.item && !r.total_cost;
  };

  const workingInvoiceItems = padInvoiceRows(rawInvoiceItems);

  const saveInvoiceItems = (rows: SalesInvoiceItem[]) => {
    let trimmed = [...rows];
    while (trimmed.length > MIN_INVOICE_ROWS && isInvoiceItemEmpty(trimmed[trimmed.length - 1])) {
      trimmed.pop();
    }
    set({ invoice_items: trimmed });
  };

  const updateInvoiceItem = (idx: number, patch: Partial<SalesInvoiceItem>) => {
    const rows = padInvoiceRows(workingInvoiceItems, Math.max(MIN_INVOICE_ROWS, idx + 1));
    rows[idx] = { ...rows[idx], ...patch };
    saveInvoiceItems(rows);
  };

  const addInvoiceItem = () => {
    const rows = [...workingInvoiceItems];
    rows.push({ ...EMPTY_INVOICE_ITEM, s_no: String(rows.length + 1) });
    // Don't trim when adding - we want to keep the new empty row
    set({ invoice_items: rows });
  };

  const removeInvoiceItem = (idx: number) => {
    const rows = [...workingInvoiceItems];
    if (rows.length > MIN_INVOICE_ROWS) {
      rows.splice(idx, 1);
      rows.forEach((r, i) => {
        r.s_no = String(i + 1);
      });
    } else {
      rows[idx] = { ...EMPTY_INVOICE_ITEM, s_no: String(idx + 1) };
    }
    saveInvoiceItems(rows);
  };

  const handleColResizeStart = (e: React.MouseEvent, colKey: string, currentWidth: number) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = colKey;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = colWidths[colKey] ?? currentWidth;
    const onMouseMove = (ev: MouseEvent) => {
      if (!resizingCol.current) return;
      const delta = ev.clientX - resizeStartX.current;
      const newWidth = Math.max(40, resizeStartWidth.current + delta);
      setColWidths((prev) => ({ ...prev, [resizingCol.current!]: newWidth }));
    };
    const onMouseUp = () => {
      resizingCol.current = null;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const getColWidth = (colKey: string, defaultPct: string, defaultPx: number) => {
    if (colWidths[colKey]) return `${colWidths[colKey]}px`;
    return defaultPct;
  };

  return (
    <div
      id="sales-performance-report"
      className="w-full bg-white text-gray-900 font-sans"
      style={{ fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif" }}
    >
      {/* 1) HEADER BANNER */}
      <div
        className="relative w-full overflow-hidden rounded-t-lg"
        style={{
          background:
            "linear-gradient(110deg, #c7ecf7 0%, #c7ecf7 32%, #0a1f3d 32%, #0a1f3d 75%, #2a446b 75%, #2a446b 100%)",
          minHeight: "130px",
        }}
      >
        <div className="grid grid-cols-3 items-stretch">
          <div className="flex items-center justify-center py-6 px-4">
            <div className="flex flex-col items-center gap-1">
              <svg viewBox="0 0 140 120" className="h-20 w-auto" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="salesLogoBg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0a1f3d" />
                    <stop offset="100%" stopColor="#1a3a68" />
                  </linearGradient>
                </defs>
                <path
                  d="M70 6 C35 6 6 35 6 70 C6 98 28 114 70 114 C112 114 134 98 134 70 C134 35 105 6 70 6 Z"
                  fill="url(#salesLogoBg)"
                />
                <circle cx="40" cy="44" r="5.5" fill="#f7a03c" />
                <text
                  x="70"
                  y="82"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="44"
                  fontWeight="900"
                  fontFamily="'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                >
                  iB
                </text>
                <circle cx="94" cy="42" r="5" fill="#f7a03c" />
              </svg>
              <div className="text-[#0a1f3d] font-bold text-sm tracking-wide">
                iBrand <span className="text-[#f7a03c]">Africa</span>
                <span className="ml-0.5 text-[8px] align-top">™</span>
              </div>
            </div>
          </div>

          <div className="col-span-2 flex items-center px-6 py-6">
            <div className="w-full space-y-1">
              {readOnly ? (
                <>
                  <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                    {data.report_banner_line1 || "CSR WEEKLY"}
                  </h1>
                  <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                    {data.report_banner_line2 || "PERFORMANCE"}
                  </h1>
                  <h1 className="text-white font-black leading-tight tracking-wide" style={{ fontSize: "2.1rem" }}>
                    {data.report_banner_line3 || "REPORT FORM"}
                  </h1>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={data.report_banner_line1 ?? ""}
                    placeholder="CSR WEEKLY"
                    onChange={(e) => set({ report_banner_line1: e.target.value || null })}
                    className="w-full bg-transparent text-white font-black leading-tight tracking-wide placeholder:text-white/40 outline-none border-b border-white/20 focus:border-white/60 transition-colors"
                    style={{ fontSize: "2.1rem" }}
                  />
                  <input
                    type="text"
                    value={data.report_banner_line2 ?? ""}
                    placeholder="PERFORMANCE"
                    onChange={(e) => set({ report_banner_line2: e.target.value || null })}
                    className="w-full bg-transparent text-white font-black leading-tight tracking-wide placeholder:text-white/40 outline-none border-b border-white/20 focus:border-white/60 transition-colors"
                    style={{ fontSize: "2.1rem" }}
                  />
                  <input
                    type="text"
                    value={data.report_banner_line3 ?? ""}
                    placeholder="REPORT FORM"
                    onChange={(e) => set({ report_banner_line3: e.target.value || null })}
                    className="w-full bg-transparent text-white font-black leading-tight tracking-wide placeholder:text-white/40 outline-none border-b border-white/20 focus:border-white/60 transition-colors"
                    style={{ fontSize: "2.1rem" }}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2) NOTE SECTION - Sales specific */}
      <div className="border-x border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h2 className="text-center font-bold py-2 text-xl tracking-wider text-gray-800">NOTE</h2>
        </div>
        <div className="px-6 py-4">
          <p className="text-base text-gray-800 leading-relaxed">
            <span className="font-bold mr-2">NOTE:</span>
            This form is designed to monitor marketing output, revenue generation, and project progress for each team
            member. Each individual is expected to meet or exceed the weekly performance threshold of <strong>₦1,500,000</strong>{" "}
            through ongoing or completed projects.
          </p>
        </div>
      </div>

      {/* 3) INDIVIDUAL INFORMATION */}
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
              <td className="border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">Designation/Role</td>
              <td className="border-r border-gray-400">
                <Cell
                  value={data.report_designation}
                  onChange={(v) => set({ report_designation: v })}
                  readOnly={readOnly}
                  placeholder="e.g. CSR / Sales Executive"
                />
              </td>
              <td className="border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100">Supervisor/Team Lead</td>
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

      {/* 4) SALES PROJECTS TABLE */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            PROJECTS
            {!readOnly && (
              <span className="ml-2 font-normal text-[10px] text-muted-foreground tracking-normal">
                (Drag rows to reorder · Drag column edges to resize)
              </span>
            )}
          </h3>
        </div>
        <table className="w-full border-collapse text-[11px] table-fixed">
          <colgroup>
            {!readOnly && <col style={{ width: "28px" }} />}
            <col style={{ width: getColWidth("s_sales_no", "4%", 40) }} />
            <col style={{ width: getColWidth("s_brand_name", "13%", 120) }} />
            <col style={{ width: getColWidth("s_contact", "11%", 100) }} />
            <col style={{ width: getColWidth("s_project_type", "11%", 100) }} />
            <col style={{ width: getColWidth("s_value", "10%", 95) }} />
            <col style={{ width: getColWidth("s_date_conf", "10%", 90) }} />
            <col style={{ width: getColWidth("s_category", "11%", 100) }} />
            <col style={{ width: getColWidth("s_edo", "10%", 90) }} />
            <col style={{ width: getColWidth("s_assigned", "11%", 100) }} />
            {!readOnly && <col style={{ width: "52px" }} />}
          </colgroup>
          <thead>
            <tr className="border-b border-gray-400 bg-gray-100 select-none">
              {!readOnly && (
                <th className="border-r border-gray-400 px-0.5 py-1.5 text-center font-semibold w-[28px]" title="Drag handle">
                  <span className="opacity-40">⋮⋮</span>
                </th>
              )}
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-center font-semibold overflow-hidden">
                S/No
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_sales_no", 40)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-left font-semibold overflow-hidden">
                Brand Name
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_brand_name", 120)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-left font-semibold overflow-hidden">
                Contact Number
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_contact", 100)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-left font-semibold overflow-hidden">
                Project Type
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_project_type", 100)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-center font-semibold overflow-hidden">
                Project Value ₦
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_value", 95)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-center font-semibold overflow-hidden">
                Date Confirmed
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_date_conf", 90)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-left font-semibold overflow-hidden">
                Category (Location)
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_category", 100)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-center font-semibold overflow-hidden">
                EDO
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_edo", 90)}
                  />
                )}
              </th>
              <th className="relative border-r border-gray-400 px-1 py-1.5 text-left font-semibold overflow-hidden">
                Assigned Official
                {!readOnly && (
                  <div
                    className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors"
                    onMouseDown={(e) => handleColResizeStart(e, "s_assigned", 100)}
                  />
                )}
              </th>
              {!readOnly && (
                <th className="w-[52px] py-1.5 text-center font-semibold">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 hover:bg-primary/10 hover:text-primary"
                    onClick={addSalesProject}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {workingSalesProjects.map((row, idx) => {
              const isDragging = dragIndex === idx;
              const isOver = dragOverIndex === idx && dragIndex !== null && dragIndex !== idx;
              return (
                <tr
                  key={idx}
                  draggable={!readOnly}
                  onDragStart={(e) => {
                    if (readOnly) return;
                    setDragIndex(idx);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    if (readOnly || dragIndex === null) return;
                    e.preventDefault();
                    if (dragOverIndex !== idx) setDragOverIndex(idx);
                  }}
                  onDragLeave={() => {
                    if (dragOverIndex === idx) setDragOverIndex(null);
                  }}
                  onDrop={(e) => {
                    if (readOnly || dragIndex === null) return;
                    e.preventDefault();
                    moveSalesRow(dragIndex, idx);
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={`border-b border-gray-300 transition-colors ${
                    isDragging ? "opacity-40 bg-primary/10" : ""
                  } ${isOver ? "border-t-2 border-t-primary bg-primary/5" : ""}`}
                >
                  {!readOnly && (
                    <td className="border-r border-gray-300 text-center px-0 py-0.5 w-[28px] align-middle cursor-grab active:cursor-grabbing">
                      <div className="flex items-center justify-center h-[34px] text-muted-foreground/50 hover:text-primary hover:bg-primary/5 rounded-sm transition-colors">
                        <GripVertical className="size-3.5" />
                      </div>
                    </td>
                  )}
                  <td className="border-r border-gray-300 text-center px-1 py-0.5">
                    <Cell
                      value={row.s_no || idx + 1}
                      onChange={(v) => updateSalesProject(idx, { s_no: v })}
                      readOnly={readOnly}
                      className="text-center"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.brand_name}
                      onChange={(v) => updateSalesProject(idx, { brand_name: v })}
                      readOnly={readOnly}
                      placeholder="Brand"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.contact_number}
                      onChange={(v) => updateSalesProject(idx, { contact_number: v })}
                      readOnly={readOnly}
                      placeholder="Contact No."
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.project_type}
                      onChange={(v) => updateSalesProject(idx, { project_type: v })}
                      readOnly={readOnly}
                      placeholder="Type"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.project_value_n}
                      onChange={(v) => updateSalesProject(idx, { project_value_n: v })}
                      readOnly={readOnly}
                      placeholder="0.00"
                      className="text-center justify-center"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      type="date"
                      value={row.date_confirmed}
                      onChange={(v) => updateSalesProject(idx, { date_confirmed: v })}
                      readOnly={readOnly}
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.category_location}
                      onChange={(v) => updateSalesProject(idx, { category_location: v })}
                      readOnly={readOnly}
                      placeholder="Category/Location"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.edo}
                      onChange={(v) => updateSalesProject(idx, { edo: v })}
                      readOnly={readOnly}
                      placeholder="EDO"
                      className="text-center justify-center"
                    />
                  </td>
                  <td className="border-r border-gray-300 px-0.5 overflow-hidden">
                    <Cell
                      value={row.assigned_official}
                      onChange={(v) => updateSalesProject(idx, { assigned_official: v })}
                      readOnly={readOnly}
                      placeholder="Official"
                    />
                  </td>
                  {!readOnly && (
                    <td className="text-center px-0.5 py-0.5 w-[52px]">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={`h-6 w-6 transition-colors ${
                          isSalesRowEmpty(row) && workingSalesProjects.length === MIN_ROWS
                            ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-current"
                            : "hover:bg-destructive/10 hover:text-destructive"
                        }`}
                        disabled={isSalesRowEmpty(row) && workingSalesProjects.length === MIN_ROWS}
                        onClick={() => removeSalesProject(idx)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 5) SALES PERFORMANCE SUMMARY - 8 fields with resizable columns */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">
            PERFORMANCE SUMMARY
            {!readOnly && (
              <span className="ml-2 font-normal text-[10px] text-muted-foreground tracking-normal">
                (Drag column edges to resize and see full content)
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="border-collapse text-xs table-fixed" style={{ minWidth: '1200px' }}>
            <colgroup>
              <col style={{ width: getColWidth("perf_label_1", "22%", 220) }} />
              <col style={{ width: getColWidth("perf_value_1", "11%", 150) }} />
              <col style={{ width: getColWidth("perf_label_2", "23%", 240) }} />
              <col style={{ width: getColWidth("perf_value_2", "11%", 150) }} />
              <col style={{ width: getColWidth("perf_label_3", "22%", 280) }} />
              <col style={{ width: getColWidth("perf_value_3", "11%", 150) }} />
              <col style={{ width: getColWidth("perf_label_4", "22%", 220) }} />
              <col style={{ width: getColWidth("perf_value_4", "11%", 180) }} />
            </colgroup>
            <tbody>
              <tr className="border-b border-gray-400">
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Number of Projects
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_1", 220)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_number_of_projects}
                    onChange={(v) => set({ sales_perf_number_of_projects: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_1", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Total Project Value (₦)
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_2", 240)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_total_project_value}
                    onChange={(v) => set({ sales_perf_total_project_value: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_2", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Variance against Weekly Target (₦)
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_3", 280)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_variance_against_target}
                    onChange={(v) => set({ sales_perf_variance_against_target: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_3", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Net Indicator
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_4", 220)}
                    />
                  )}
                </td>
                <td className="relative text-center">
                  <Cell
                    value={data.sales_perf_net_indicator}
                    onChange={(v) => set({ sales_perf_net_indicator: v })}
                    readOnly={readOnly}
                    placeholder="Surplus/Deficit"
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_4", 180)}
                    />
                  )}
                </td>
              </tr>
              <tr>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Leads Generated
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_1", 220)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_leads_generated}
                    onChange={(v) => set({ sales_perf_leads_generated: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_1", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Proposals sent
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_2", 240)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_proposals_sent}
                    onChange={(v) => set({ sales_perf_proposals_sent: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_2", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Total Pending Deals
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_3", 280)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 text-center">
                  <Cell
                    value={data.sales_perf_total_pending_deals}
                    onChange={(v) => set({ sales_perf_total_pending_deals: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_3", 150)}
                    />
                  )}
                </td>
                <td className="relative border-r border-gray-400 px-3 py-2 font-semibold bg-gray-100 select-none">
                  Total Completed/Closed projects
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_label_4", 220)}
                    />
                  )}
                </td>
                <td className="relative text-center">
                  <Cell
                    value={data.sales_perf_total_completed_projects}
                    onChange={(v) => set({ sales_perf_total_completed_projects: v })}
                    readOnly={readOnly}
                    className="text-center justify-center font-medium text-info"
                  />
                  {!readOnly && (
                    <div
                      className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize hover:bg-primary/60 active:bg-primary transition-colors z-10"
                      onMouseDown={(e) => handleColResizeStart(e, "perf_value_4", 180)}
                    />
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 6) SELF EVALUATION — same structure */}
      <div className="border-x border-t-2 border-gray-400">
        <div className="border-b-2 border-gray-400">
          <h3 className="text-center font-bold py-2 text-base tracking-wider text-gray-800">SELF EVALUATION</h3>
        </div>
        <table className="w-full border-collapse text-xs">
          <tbody>
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
            <tr className="border-b border-gray-300">
              <td className="border-r border-gray-300 px-3 py-2 font-semibold bg-gray-100 align-top">Key areas for improvement</td>
              <td colSpan={5}>
                <Cell
                  textarea
                  value={data.self_eval_improvement}
                  onChange={(v) => set({ self_eval_improvement: v })}
                  readOnly={readOnly}
                />
              </td>
            </tr>
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
            {[0, 1, 2].map((i) => (
              <tr key={`sales-spacer-${i}`} className="border-b border-gray-300 h-[34px]">
                <td className="border-r border-gray-300 bg-gray-100/40" />
                <td colSpan={5} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 7) SUPERVISOR'S REMARK + SIGN/DATE */}
      <div className="border-x border-t-2 border-b-2 border-gray-400 rounded-b-sm">
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="w-[55%] border-r border-gray-400 px-3 py-1.5 font-semibold bg-gray-100 align-top">
                Supervisor's Remark
              </td>
              <td className="w-[45%] px-3 py-1.5 font-semibold bg-gray-100 align-top">Supervisor's Sign/Date</td>
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

      {/* 8) EXPANDABLE INVOICE SECTION */}
      <div className="mt-5 rounded-xl border overflow-hidden">
        <button
          type="button"
          onClick={() => !readOnly && setInvoiceOpen((v) => !v)}
          className={`w-full flex items-center gap-2 px-4 py-3 text-left transition-colors ${
            readOnly ? "bg-[#e6a817] cursor-default" : "bg-[#e6a817] hover:bg-[#d49a14] cursor-pointer"
          }`}
        >
          <Building2 className="size-4 text-white shrink-0" />
          <span className="text-sm font-semibold text-white flex-1">
            INVOICE / RECEIPT SECTION (iBrand Africa LTD)
          </span>
          {readOnly ? (
            <ChevronDown className="size-4 text-white shrink-0" />
          ) : invoiceOpen ? (
            <ChevronDown className="size-4 text-white shrink-0" />
          ) : (
            <ChevronRight className="size-4 text-white shrink-0" />
          )}
        </button>

        {invoiceOpen && (
          <div className="p-5 space-y-5 bg-white">
            {/* Company Header Row */}
            <div className="grid grid-cols-3 gap-0 border border-[#e6a817]">
              <div className="col-span-1 p-4 border-r border-[#e6a817]">
                <h2 className="text-2xl font-black text-[#0a1f3d] tracking-tight">iBrand Africa LTD</h2>
              </div>
              <div className="col-span-2 p-4 space-y-1 text-xs">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Cell
                      value={data.invoice_company_address}
                      onChange={(v) => set({ invoice_company_address: v })}
                      readOnly={readOnly}
                      placeholder="House 5, 5th Street, Elekahia Housing Estate, Port Harcourt."
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex gap-1 items-start">
                      <span className="font-semibold text-[11px] whitespace-nowrap shrink-0">Phone:</span>
                      <Cell
                        value={data.invoice_company_phone}
                        onChange={(v) => set({ invoice_company_phone: v })}
                        readOnly={readOnly}
                        placeholder="0802-126-0000"
                      />
                    </div>
                    <div className="flex gap-1 items-start">
                      <span className="font-semibold text-[11px] whitespace-nowrap shrink-0">Fax:</span>
                      <Cell
                        value={data.invoice_company_fax}
                        onChange={(v) => set({ invoice_company_fax: v })}
                        readOnly={readOnly}
                        placeholder="0803-747-8593"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Cell
                      value={data.invoice_company_email}
                      onChange={(v) => set({ invoice_company_email: v })}
                      readOnly={readOnly}
                      placeholder="info@ibrand..."
                    />
                    <Cell
                      value={data.invoice_company_website}
                      onChange={(v) => set({ invoice_company_website: v })}
                      readOnly={readOnly}
                      placeholder="www.ibrand..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Bill To + Invoice Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h3 className="text-lg text-gray-700 font-semibold">Bill To:</h3>
                <Cell
                  value={data.invoice_bill_to_name}
                  onChange={(v) => set({ invoice_bill_to_name: v })}
                  readOnly={readOnly}
                  placeholder="The Management / Client Name"
                  className="text-base font-medium h-auto py-1"
                />
                <Cell
                  value={data.invoice_bill_to_address}
                  onChange={(v) => set({ invoice_bill_to_address: v })}
                  readOnly={readOnly}
                  placeholder="24 Alhaji Tella Street Egbeda Lagos"
                  className="text-base"
                />
                <Cell
                  value={data.invoice_bill_to_email}
                  onChange={(v) => set({ invoice_bill_to_email: v })}
                  readOnly={readOnly}
                  placeholder="client@email.com"
                />
                <Cell
                  value={data.invoice_bill_to_phone}
                  onChange={(v) => set({ invoice_bill_to_phone: v })}
                  readOnly={readOnly}
                  placeholder="08023233782"
                  className="text-base font-medium"
                />
              </div>
              <div className="space-y-1 text-sm flex flex-col justify-center items-end">
                <div className="flex gap-2 items-center">
                  <span className="font-medium text-gray-600">Invoice #:</span>
                  <Cell
                    value={data.invoice_number}
                    onChange={(v) => set({ invoice_number: v })}
                    readOnly={readOnly}
                    placeholder="590014"
                    className="font-semibold text-right w-[140px]"
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <span className="font-medium text-gray-600">Invoice Date:</span>
                  <Cell
                    type="date"
                    value={data.invoice_date}
                    onChange={(v) => set({ invoice_date: v })}
                    readOnly={readOnly}
                    className="w-[140px]"
                  />
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-y-4 border-[#e6a817]">
                  <th className="py-2.5 px-4 text-left font-bold bg-[#fff8e8] relative">
                    <div className="flex items-center gap-2">
                      <span>Item</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Add invoice item clicked', workingInvoiceItems.length);
                            addInvoiceItem();
                          }}
                          className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-primary/20 hover:text-primary transition-colors cursor-pointer z-50"
                          title="Add new invoice item"
                          style={{ position: 'relative', zIndex: 50 }}
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </div>
                  </th>
                  <th className="py-2.5 px-4 text-right font-bold bg-[#fff8e8] w-[180px]">Total Cost (₦)</th>
                  {!readOnly && <th className="w-[52px] py-2.5 bg-[#fff8e8]" />}
                </tr>
              </thead>
              <tbody>
                {workingInvoiceItems.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-200 last:border-0">
                    <td className="py-2 px-4 border-r border-gray-100">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-xs font-semibold shrink-0 w-5">{item.s_no || idx + 1}</span>
                        <Cell
                          value={item.item}
                          onChange={(v) => {
                            const updates: Partial<SalesInvoiceItem> = { item: v };
                            if (!item.s_no) updates.s_no = String(idx + 1);
                            updateInvoiceItem(idx, updates);
                          }}
                          readOnly={readOnly}
                          placeholder="e.g. Corporate Shirt Design"
                          className="text-base font-medium h-auto py-1"
                        />
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <Cell
                        value={item.total_cost}
                        onChange={(v) => updateInvoiceItem(idx, { total_cost: v })}
                        readOnly={readOnly}
                        placeholder="5,000"
                        className="text-right justify-end font-semibold text-lg w-full"
                      />
                    </td>
                    {!readOnly && (
                      <td className="text-center px-0.5 py-1.5 w-[52px]">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className={`h-6 w-6 transition-colors ${
                            isInvoiceItemEmpty(item) && workingInvoiceItems.length === MIN_INVOICE_ROWS
                              ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-current"
                              : "hover:bg-destructive/10 hover:text-destructive"
                          }`}
                          disabled={isInvoiceItemEmpty(item) && workingInvoiceItems.length === MIN_INVOICE_ROWS}
                          onClick={() => removeInvoiceItem(idx)}
                        >
                          <Trash2 className="size-3" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {/* Total Row */}
                <tr className="border-t-4 border-[#e6a817]">
                  <td className="py-4 px-4 text-right font-bold text-xl bg-white">Total</td>
                  <td className="py-4 px-4 text-right">
                    <Cell
                      value={data.invoice_total}
                      onChange={(v) => set({ invoice_total: v })}
                      readOnly={readOnly}
                      placeholder="₦ 5,000"
                      className="text-right justify-end font-black text-2xl underline underline-offset-4 decoration-2 w-full"
                    />
                  </td>
                  {!readOnly && <td />}
                </tr>
              </tbody>
            </table>

            {/* Bank Payment Info */}
            <div className="space-y-2 pt-2">
              <h3 className="font-bold text-sm uppercase tracking-wide text-gray-700">
                All Checks Payable to iBrand Africa LTD
              </h3>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="flex gap-1.5 items-start">
                  <span className="font-bold text-gray-600 whitespace-nowrap shrink-0">Account Name:</span>
                  <Cell
                    value={data.invoice_bank_account_name}
                    onChange={(v) => set({ invoice_bank_account_name: v })}
                    readOnly={readOnly}
                    placeholder="iBrand Africa Ltd"
                  />
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="font-bold text-gray-600 whitespace-nowrap shrink-0">Account Number:</span>
                  <Cell
                    value={data.invoice_bank_account_number}
                    onChange={(v) => set({ invoice_bank_account_number: v })}
                    readOnly={readOnly}
                    placeholder="5600779289"
                  />
                </div>
                <div className="flex gap-1.5 items-start">
                  <span className="font-bold text-gray-600 whitespace-nowrap shrink-0">Bank Name:</span>
                  <Cell
                    value={data.invoice_bank_name}
                    onChange={(v) => set({ invoice_bank_name: v })}
                    readOnly={readOnly}
                    placeholder="Fidelity Bank PLC"
                  />
                </div>
              </div>
            </div>

            {/* Footer Note */}
            <div className="pt-3 border-t border-gray-200">
              <div className="text-red-600 font-semibold text-xs flex items-start gap-1.5">
                <span className="font-black uppercase shrink-0">Note:</span>
                {readOnly ? (
                  <div className="text-gray-800 font-normal leading-relaxed">
                    {data.invoice_footer_note ||
                      "All payments should be made to accounts bearing iBrand Africa. Any payment made to accounts with another name will not be acknowledged."}
                  </div>
                ) : (
                  <Textarea
                    value={data.invoice_footer_note ?? ""}
                    onChange={(e) => set({ invoice_footer_note: e.target.value || null })}
                    placeholder="All payments should be made to accounts bearing iBrand Africa. Any payment made to accounts with another name will not be acknowledged."
                    className="text-gray-800 font-normal text-xs min-h-[50px] border border-gray-300 rounded p-2 resize-y"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 9) REFERENCE LINK */}
      <div className="mt-5 rounded-xl border border-info/20 bg-info/5 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-info shrink-0" />
          <p className="text-sm font-medium">
            Reference Link <span className="text-muted-foreground font-normal text-xs">(optional)</span>
          </p>
        </div>
        <p className="text-muted-foreground text-xs">
          Add a link to your work — Google Drive, GitHub, Figma, Notion, YouTube, etc.
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
              <span className="truncate max-w-md">{data.report_link_label || data.report_link}</span>
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
                Link label <span className="text-muted-foreground font-normal">(what to show)</span>
              </Label>
              <Input
                value={data.report_link_label ?? ""}
                onChange={(e) => set({ report_link_label: e.target.value || null })}
                placeholder="e.g. View proposal document"
                className="h-9 text-xs"
              />
            </div>
          </div>
        )}
      </div>

      {/* 10) ATTACHED FILE */}
      <div className="mt-4 space-y-2">
        <Label className="text-xs">
          Attach file <span className="text-muted-foreground font-normal">(optional — max 900 KB)</span>
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
              <span className="min-w-0 flex-1 truncate text-sm">{data.attached_file_name}</span>
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

      <div className="mt-6 pt-3 border-t border-gray-200 text-[10px] text-muted-foreground/60 text-center">
        <FileText className="size-3 inline mr-1" />
        iBrand Africa — CSR / Sales Weekly Performance Report Form
      </div>
    </div>
  );
}
