import type { Activity, Profile, Project, Report, Task } from "./types";

export type Scope = {
  userId: string | null;
  departmentId: string | null;
  isSuperAdmin: boolean;
  isDeptAdmin: boolean;
};

/**
 * Client-side mirror of the database access rules. The database is the source
 * of truth (RLS blocks anything else) — this keeps the UI honest as well.
 */
function pick<T>(rows: T[], scope: Scope, own: (row: T) => boolean, dept: (row: T) => string | null) {
  if (scope.isSuperAdmin) return rows;
  if (scope.isDeptAdmin) return rows.filter((r) => dept(r) === scope.departmentId || own(r));
  return rows.filter(own);
}

export const scopeProjects = (rows: Project[], s: Scope) =>
  pick(rows, s, (r) => r.owner_id === s.userId, (r) => r.department_id);

export const scopeTasks = (rows: Task[], s: Scope) =>
  pick(rows, s, (r) => r.owner_id === s.userId, (r) => r.department_id);

export const scopeReports = (rows: Report[], s: Scope) =>
  pick(rows, s, (r) => r.author_id === s.userId, (r) => r.department_id);

export const scopeActivities = (rows: Activity[], s: Scope) =>
  pick(rows, s, (r) => r.actor_id === s.userId, (r) => r.department_id);

export const scopePeople = (rows: Profile[], s: Scope) => {
  if (s.isSuperAdmin) return rows;
  if (s.isDeptAdmin) return rows.filter((p) => p.department_id === s.departmentId);
  return rows.filter((p) => p.id === s.userId);
};

export const isOverdue = (t: Task) =>
  t.status === "expired" ||
  (!!t.due_date && t.status !== "done" && new Date(t.due_date) < new Date(new Date().toDateString()));
