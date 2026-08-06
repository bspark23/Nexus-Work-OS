export const PROJECT_STATUSES = [
  { value: "not_started", label: "Not Started", tone: "neutral" },
  { value: "in_progress", label: "In Progress", tone: "info" },
  { value: "blocked", label: "Blocked", tone: "destructive" },
  { value: "under_review", label: "Under Review", tone: "warning" },
  { value: "completed", label: "Completed", tone: "success" },
] as const;

export const TASK_STATUSES = [
  { value: "pending", label: "Pending", tone: "neutral" },
  { value: "in_progress", label: "In Progress", tone: "info" },
  { value: "blocked", label: "Blocked", tone: "destructive" },
  { value: "done", label: "Done", tone: "success" },
] as const;

export const PRIORITIES = [
  { value: "low", label: "Low", tone: "neutral" },
  { value: "medium", label: "Medium", tone: "info" },
  { value: "high", label: "High", tone: "warning" },
  { value: "critical", label: "Critical", tone: "destructive" },
] as const;

export const REPORT_TYPES = [
  { value: "daily", label: "Daily Report" },
  { value: "weekly", label: "Weekly Report" },
  { value: "monthly", label: "Monthly Report" },
] as const;

export const REPORT_STATUSES = [
  { value: "draft", label: "Draft", tone: "neutral" },
  { value: "submitted", label: "Submitted", tone: "info" },
  { value: "reviewed", label: "Reviewed", tone: "success" },
] as const;

export type Tone = "neutral" | "info" | "warning" | "success" | "destructive";

export const toneClasses: Record<Tone, string> = {
  neutral: "bg-neutral/12 text-muted-foreground border-neutral/25",
  info: "bg-info/12 text-info border-info/30",
  warning: "bg-warning/15 text-warning border-warning/35",
  success: "bg-success/12 text-success border-success/30",
  destructive: "bg-destructive/12 text-destructive border-destructive/30",
};

export const toneBar: Record<Tone, string> = {
  neutral: "bg-neutral",
  info: "bg-info",
  warning: "bg-warning",
  success: "bg-success",
  destructive: "bg-destructive",
};

export function labelOf(
  list: ReadonlyArray<{ value: string; label: string }>,
  value: string | null | undefined,
) {
  return list.find((i) => i.value === value)?.label ?? "—";
}

export function toneOf(
  list: ReadonlyArray<{ value: string; label: string; tone?: string }>,
  value: string | null | undefined,
): Tone {
  return ((list.find((i) => i.value === value) as { tone?: Tone } | undefined)?.tone ??
    "neutral") as Tone;
}

/** Auth uses a deterministic internal address so people can sign in with a username. */
export function usernameToAuthEmail(username: string) {
  return `${username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@nexus-workos.internal`;
}
