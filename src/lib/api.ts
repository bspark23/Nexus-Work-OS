import { supabase } from "@/integrations/supabase/client";
import type {
  Activity,
  Attachment,
  Department,
  Notification,
  Profile,
  Project,
  Report,
  Task,
} from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

/* ---------------- departments ---------------- */
export async function fetchDepartments() {
  return unwrap<Department[]>(
    await supabase.from("departments").select("*").order("name") as never,
  );
}
export async function createDepartment(input: { name: string; description?: string }) {
  const { data, error } = await supabase
    .from("departments")
    .insert(input as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Department;
}
export async function updateDepartment(id: string, patch: Partial<Department>) {
  const { error } = await supabase.from("departments").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteDepartment(id: string) {
  const { error } = await supabase.from("departments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- profiles / roles ---------------- */
export async function fetchProfiles() {
  return unwrap<Profile[]>(
    await supabase.from("profiles").select("*").order("full_name") as never,
  );
}
export async function fetchProfile(id: string) {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Profile | null;
}
export async function updateProfile(id: string, patch: Partial<Profile>) {
  const { error } = await supabase.from("profiles").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function fetchRoles() {
  return unwrap<{ user_id: string; role: string }[]>(
    await supabase.from("user_roles").select("user_id, role") as never,
  );
}

/* ---------------- projects ---------------- */
export async function fetchProjects(ownerId?: string) {
  let q = supabase.from("projects").select("*").order("updated_at", { ascending: false });
  if (ownerId) q = q.eq("owner_id", ownerId);
  return unwrap<Project[]>((await q) as never);
}
export async function fetchProject(id: string) {
  const { data, error } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as Project | null;
}
export async function saveProject(input: Partial<Project> & { id?: string }) {
  if (input.id) {
    const { id, ...patch } = input;
    const { error } = await supabase.from("projects").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase
    .from("projects")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as unknown as { id: string }).id;
}
export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- tasks ---------------- */
export async function fetchTasks(ownerId?: string) {
  let q = supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (ownerId) q = q.eq("owner_id", ownerId);
  return unwrap<Task[]>((await q) as never);
}
export async function saveTask(input: Partial<Task> & { id?: string }) {
  if (input.id) {
    const { id, ...patch } = input;
    const { error } = await supabase.from("tasks").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase
    .from("tasks")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as unknown as { id: string }).id;
}
export async function deleteTask(id: string) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- reports ---------------- */
export async function fetchReports(authorId?: string) {
  let q = supabase.from("reports").select("*").order("report_date", { ascending: false });
  if (authorId) q = q.eq("author_id", authorId);
  return unwrap<Report[]>((await q) as never);
}
export async function saveReport(input: Partial<Report> & { id?: string }) {
  if (input.id) {
    const { id, ...patch } = input;
    const { error } = await supabase.from("reports").update(patch as never).eq("id", id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase
    .from("reports")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as unknown as { id: string }).id;
}
export async function deleteReport(id: string) {
  const { error } = await supabase.from("reports").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/* ---------------- attachments + storage ---------------- */
export async function fetchAttachments() {
  return unwrap<Attachment[]>(
    await supabase.from("attachments").select("*").order("created_at", { ascending: false }) as never,
  );
}

export async function uploadAttachment(opts: {
  file: File;
  userId: string;
  projectId?: string | null;
  reportId?: string | null;
  taskId?: string | null;
  customerJobId?: string | null;
  departmentId?: string | null;
  kind?: string;
}) {
  const ext = opts.file.name.split(".").pop() ?? "bin";
  const path = `${opts.userId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from("work-files")
    .upload(path, opts.file, { upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data: signed } = await supabase.storage
    .from("work-files")
    .createSignedUrl(path, 60 * 60 * 24 * 365);

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      owner_id: opts.userId,
      project_id: opts.projectId ?? null,
      report_id: opts.reportId ?? null,
      task_id: opts.taskId ?? null,
      customer_job_id: opts.customerJobId ?? null,
      department_id: opts.departmentId ?? null,
      file_name: opts.file.name,
      file_path: path,
      file_url: signed?.signedUrl ?? "",
      file_type: opts.file.type,
      file_size: opts.file.size,
      kind: opts.kind ?? (opts.file.type.startsWith("image/") ? "screenshot" : "file"),
    } as never)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Attachment;
}

export async function signedUrlFor(path: string) {
  const { data } = await supabase.storage.from("work-files").createSignedUrl(path, 3600);
  return data?.signedUrl ?? "";
}

export async function deleteAttachment(a: Attachment) {
  await supabase.storage.from("work-files").remove([a.file_path]);
  const { error } = await supabase.from("attachments").delete().eq("id", a.id);
  if (error) throw new Error(error.message);
}

/* ---------------- activity + notifications ---------------- */
export async function fetchActivities(limit = 200) {
  return unwrap<Activity[]>(
    await supabase
      .from("activities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit) as never,
  );
}

export async function logActivity(input: {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  department_id?: string | null;
  description: string;
}) {
  await supabase.from("activities").insert(input as never);
}

export async function fetchNotifications() {
  return unwrap<Notification[]>(
    await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(80) as never,
  );
}

export async function notifyAdmins(input: {
  actor_id: string;
  title: string;
  body?: string;
  type?: string;
}) {
  await supabase.from("notifications").insert({
    actor_id: input.actor_id,
    title: input.title,
    body: input.body ?? null,
    type: input.type ?? "info",
    audience: "admin",
    user_id: null,
  } as never);
}

export async function markNotificationRead(id: string) {
  await supabase.from("notifications").update({ read: true } as never).eq("id", id);
}

/** Log an activity and raise an admin notification in one shot. */
export async function track(opts: {
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  detail: string;
  departmentId?: string | null;
  notify?: boolean;
  type?: string;
}) {
  await logActivity({
    actor_id: opts.actorId,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    department_id: opts.departmentId ?? null,
    description: opts.detail,
  });
  if (opts.notify !== false) {
    await notifyAdmins({
      actor_id: opts.actorId,
      title: `${opts.actorName} — ${opts.action}`,
      body: opts.detail,
      type: opts.type ?? "info",
    });
  }
}
