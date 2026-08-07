import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
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

/* ─── helpers ─── */
function ts(d: unknown): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Timestamp) return d.toDate().toISOString();
  if (typeof d === "string") return d;
  return new Date(d as never).toISOString();
}

function snap<T extends { id?: string }>(s: import("firebase/firestore").DocumentSnapshot): T {
  return { id: s.id, ...s.data() } as T;
}

function snapList<T>(s: import("firebase/firestore").QuerySnapshot): T[] {
  return s.docs.map((d) => ({ id: d.id, ...d.data() })) as T[];
}

/* ─── departments ─── */
export async function fetchDepartments(): Promise<Department[]> {
  const q = query(collection(db, "departments"), orderBy("name"));
  const snap = await getDocs(q);
  return snapList<Department>(snap).map((d) => ({
    ...d,
    created_at: ts(d.created_at),
  }));
}

export async function createDepartment(input: { name: string; description?: string }) {
  const ref2 = await addDoc(collection(db, "departments"), {
    name: input.name,
    description: input.description ?? null,
    created_at: serverTimestamp(),
  });
  return { id: ref2.id, ...input, created_at: new Date().toISOString() } as Department;
}

export async function updateDepartment(id: string, patch: Partial<Department>) {
  await updateDoc(doc(db, "departments", id), patch as never);
}

export async function deleteDepartment(id: string) {
  await deleteDoc(doc(db, "departments", id));
}

/* ─── profiles / roles ─── */
export async function fetchProfiles(): Promise<Profile[]> {
  const q = query(collection(db, "profiles"), orderBy("full_name"));
  const snap = await getDocs(q);
  return snapList<Profile>(snap).map((p) => ({
    ...p,
    created_at: ts(p.created_at),
    last_seen_at: ts(p.last_seen_at),
  }));
}

export async function fetchProfile(id: string): Promise<Profile | null> {
  const s = await getDoc(doc(db, "profiles", id));
  if (!s.exists()) return null;
  const p = snap<Profile>(s);
  return { ...p, created_at: ts(p.created_at), last_seen_at: ts(p.last_seen_at) };
}

export async function updateProfile(id: string, patch: Partial<Profile>) {
  await updateDoc(doc(db, "profiles", id), patch as never);
}

export async function fetchRoles(): Promise<{ user_id: string; role: string }[]> {
  const snap = await getDocs(collection(db, "user_roles"));
  return snap.docs.map((d) => {
    const data = d.data();
    return { user_id: d.id, role: (data["role"] as string) ?? "employee" };
  });
}

/* ─── projects ─── */
export async function fetchProjects(ownerId?: string): Promise<Project[]> {
  let q = query(collection(db, "projects"), orderBy("updated_at", "desc"));
  if (ownerId) q = query(collection(db, "projects"), where("owner_id", "==", ownerId), orderBy("updated_at", "desc"));
  const snap = await getDocs(q);
  return snapList<Project>(snap).map((p) => ({
    ...p,
    created_at: ts(p.created_at),
    updated_at: ts(p.updated_at),
  }));
}

export async function fetchProject(id: string): Promise<Project | null> {
  const s = await getDoc(doc(db, "projects", id));
  if (!s.exists()) return null;
  const p = snap<Project>(s);
  return { ...p, created_at: ts(p.created_at), updated_at: ts(p.updated_at) };
}

export async function saveProject(input: Partial<Project> & { id?: string }): Promise<string> {
  const now = serverTimestamp();
  if (input.id) {
    const { id, ...patch } = input;
    await updateDoc(doc(db, "projects", id), { ...patch, updated_at: now });
    return id;
  }
  const { id: _ignore, ...data } = input;
  const ref2 = await addDoc(collection(db, "projects"), {
    ...data,
    created_at: now,
    updated_at: now,
  });
  return ref2.id;
}

export async function deleteProject(id: string) {
  await deleteDoc(doc(db, "projects", id));
}

/* ─── tasks ─── */
export async function fetchTasks(ownerId?: string): Promise<Task[]> {
  let q = query(collection(db, "tasks"), orderBy("created_at", "desc"));
  if (ownerId) q = query(collection(db, "tasks"), where("owner_id", "==", ownerId), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snapList<Task>(snap).map((t) => ({
    ...t,
    created_at: ts(t.created_at),
    updated_at: ts(t.updated_at),
  }));
}

export async function saveTask(input: Partial<Task> & { id?: string }): Promise<string> {
  const now = serverTimestamp();
  if (input.id) {
    const { id, ...patch } = input;
    await updateDoc(doc(db, "tasks", id), { ...patch, updated_at: now });
    return id;
  }
  const { id: _ignore, ...data } = input;
  const ref2 = await addDoc(collection(db, "tasks"), {
    ...data,
    created_at: now,
    updated_at: now,
  });
  return ref2.id;
}

export async function deleteTask(id: string) {
  await deleteDoc(doc(db, "tasks", id));
}

/* ─── reports ─── */
export async function fetchReports(authorId?: string): Promise<Report[]> {
  let q = query(collection(db, "reports"), orderBy("report_date", "desc"));
  if (authorId) q = query(collection(db, "reports"), where("author_id", "==", authorId), orderBy("report_date", "desc"));
  const snap = await getDocs(q);
  return snapList<Report>(snap).map((r) => ({
    ...r,
    created_at: ts(r.created_at),
    updated_at: ts(r.updated_at),
  }));
}

export async function saveReport(input: Partial<Report> & { id?: string }): Promise<string> {
  const now = serverTimestamp();
  if (input.id) {
    const { id, ...patch } = input;
    await updateDoc(doc(db, "reports", id), { ...patch, updated_at: now });
    return id;
  }
  const { id: _ignore, ...data } = input;
  const ref2 = await addDoc(collection(db, "reports"), {
    ...data,
    created_at: now,
    updated_at: now,
  });
  return ref2.id;
}

export async function deleteReport(id: string) {
  await deleteDoc(doc(db, "reports", id));
}

/* ─── attachments — stored as base64 in Firestore (no Storage needed) ─── */
export async function fetchAttachments(): Promise<Attachment[]> {
  const q = query(collection(db, "attachments"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snapList<Attachment>(snap).map((a) => ({
    ...a,
    created_at: ts(a.created_at),
  }));
}

/** Max file size for Firestore base64 storage: 900 KB */
const MAX_FILE_BYTES = 900 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string); // data:mime;base64,...
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
}): Promise<Attachment> {
  if (opts.file.size > MAX_FILE_BYTES) {
    throw new Error(
      `File too large (${(opts.file.size / 1024).toFixed(0)} KB). Max size is 900 KB on the free plan.`,
    );
  }

  // Convert file to base64 data URL — stored directly in Firestore
  const dataUrl = await fileToBase64(opts.file);

  const docRef = await addDoc(collection(db, "attachments"), {
    owner_id: opts.userId,
    project_id: opts.projectId ?? null,
    report_id: opts.reportId ?? null,
    task_id: opts.taskId ?? null,
    customer_job_id: opts.customerJobId ?? null,
    department_id: opts.departmentId ?? null,
    file_name: opts.file.name,
    file_path: `firestore/${opts.userId}/${opts.file.name}`,
    file_url: dataUrl,   // base64 data URL — works directly in <img src> and <a href>
    file_type: opts.file.type,
    file_size: opts.file.size,
    kind: opts.kind ?? (opts.file.type.startsWith("image/") ? "screenshot" : "file"),
    created_at: serverTimestamp(),
  });

  return {
    id: docRef.id,
    owner_id: opts.userId,
    project_id: opts.projectId ?? null,
    report_id: opts.reportId ?? null,
    task_id: opts.taskId ?? null,
    customer_job_id: opts.customerJobId ?? null,
    department_id: opts.departmentId ?? null,
    file_name: opts.file.name,
    file_path: `firestore/${opts.userId}/${opts.file.name}`,
    file_url: dataUrl,
    file_type: opts.file.type,
    file_size: opts.file.size,
    kind: opts.kind ?? (opts.file.type.startsWith("image/") ? "screenshot" : "file"),
    created_at: new Date().toISOString(),
  };
}

export async function deleteAttachment(a: Attachment) {
  // Base64 files are stored in Firestore — just delete the document
  await deleteDoc(doc(db, "attachments", a.id));
}

/* ─── activity + notifications ─── */
export async function fetchActivities(limitCount = 200): Promise<Activity[]> {
  const q = query(
    collection(db, "activities"),
    orderBy("created_at", "desc"),
    limit(limitCount),
  );
  const snap = await getDocs(q);
  return snapList<Activity>(snap).map((a) => ({
    ...a,
    created_at: ts(a.created_at),
  }));
}

export async function logActivity(input: {
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  department_id?: string | null;
  description: string;
}) {
  await addDoc(collection(db, "activities"), {
    ...input,
    entity_id: input.entity_id ?? null,
    department_id: input.department_id ?? null,
    created_at: serverTimestamp(),
  });
}

export async function fetchNotifications(): Promise<Notification[]> {
  const q = query(
    collection(db, "notifications"),
    orderBy("created_at", "desc"),
    limit(80),
  );
  const snap = await getDocs(q);
  return snapList<Notification>(snap).map((n) => ({
    ...n,
    created_at: ts(n.created_at),
  }));
}

export async function notifyAdmins(input: {
  actor_id: string;
  title: string;
  body?: string;
  type?: string;
}) {
  await addDoc(collection(db, "notifications"), {
    actor_id: input.actor_id,
    title: input.title,
    body: input.body ?? null,
    type: input.type ?? "info",
    audience: "admin",
    user_id: null,
    read: false,
    created_at: serverTimestamp(),
  });
}

export async function markNotificationRead(id: string) {
  await updateDoc(doc(db, "notifications", id), { read: true });
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
