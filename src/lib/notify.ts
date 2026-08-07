import { supabase } from "@/integrations/supabase/client";

type Base = { title: string; body?: string | null; type?: string; actorId?: string | null };

async function insert(rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  await supabase.from("notifications").insert(rows as never);
}

/** Notification aimed at one person. */
export function notifyUser(userId: string, n: Base) {
  return insert([
    {
      user_id: userId,
      actor_id: n.actorId ?? null,
      title: n.title,
      body: n.body ?? null,
      type: n.type ?? "info",
      audience: "personal",
    },
  ]);
}

/** Notification for the admin of a department. */
export function notifyDepartment(departmentId: string | null, n: Base) {
  if (!departmentId) return Promise.resolve();
  return insert([
    {
      user_id: null,
      department_id: departmentId,
      actor_id: n.actorId ?? null,
      title: n.title,
      body: n.body ?? null,
      type: n.type ?? "info",
      audience: "department",
    },
  ]);
}

/** Notification every Super Admin receives. */
export function notifySuperAdmins(n: Base & { departmentId?: string | null }) {
  return insert([
    {
      user_id: null,
      department_id: n.departmentId ?? null,
      actor_id: n.actorId ?? null,
      title: n.title,
      body: n.body ?? null,
      type: n.type ?? "info",
      audience: "admin",
    },
  ]);
}

/** Fan out to the employee, their department admin and every super admin. */
export async function broadcast(opts: {
  userId?: string | null;
  departmentId?: string | null;
  title: string;
  body?: string | null;
  type?: string;
  actorId?: string | null;
}) {
  const jobs: Promise<unknown>[] = [];
  if (opts.userId) jobs.push(notifyUser(opts.userId, opts));
  if (opts.departmentId) jobs.push(notifyDepartment(opts.departmentId, opts));
  jobs.push(notifySuperAdmins({ ...opts, departmentId: opts.departmentId ?? null }));
  await Promise.all(jobs);
}
