import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/integrations/firebase/config";
import type { CustomerJob, CustomerJobDepartment } from "./types";

function ts(d: unknown): string {
  if (!d) return new Date().toISOString();
  if (d instanceof Timestamp) return d.toDate().toISOString();
  if (typeof d === "string") return d;
  return new Date(d as never).toISOString();
}

/* ─── Saved File (persisted spreadsheet for reuse — shared across admins) ─── */

export type SavedFileRow = Record<string, string>;

export type SavedFile = {
  id: string;
  owner_id: string;
  owner_name: string;
  file_name: string;
  file_type: "xlsx" | "csv" | "pdf";
  columns: string[];
  rows: SavedFileRow[];
  text: string;
  updated_at: string;
  created_at: string;
};

/** Load ALL shared files (admins/super admins see everything). */
export async function fetchAllSavedFiles(): Promise<SavedFile[]> {
  const q = query(collection(db, "saved_files"), orderBy("updated_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      updated_at: ts(data["updated_at"]),
      created_at: ts(data["created_at"]),
    } as SavedFile;
  });
}

/** Load a single saved file by ID. */
export async function fetchSavedFile(fileId: string): Promise<SavedFile | null> {
  const snap = await getDoc(doc(db, "saved_files", fileId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return { id: snap.id, ...d, updated_at: ts(d["updated_at"]), created_at: ts(d["created_at"]) } as SavedFile;
}

/** Save (upsert) a shared file — keyed by userId so each user has one active file. */
export async function upsertSavedFile(
  userId: string,
  data: Pick<SavedFile, "file_name" | "file_type" | "columns" | "rows" | "text"> & { owner_name?: string },
): Promise<void> {
  await setDoc(
    doc(db, "saved_files", userId),
    {
      owner_id: userId,
      owner_name: data.owner_name ?? "",
      ...data,
      updated_at: serverTimestamp(),
      created_at: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Update only the rows (when user edits cells inline). */
export async function updateSavedFileRows(fileId: string, rows: SavedFileRow[]): Promise<void> {
  await updateDoc(doc(db, "saved_files", fileId), {
    rows,
    updated_at: serverTimestamp(),
  });
}

/** Delete a saved file. */
export async function deleteSavedFile(fileId: string): Promise<void> {
  await deleteDoc(doc(db, "saved_files", fileId));
}

export async function fetchCustomerJobs(): Promise<CustomerJob[]> {
  const q = query(collection(db, "customer_jobs"), orderBy("created_at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: ts(data["created_at"]),
      updated_at: ts(data["updated_at"]),
    } as CustomerJob;
  });
}

export async function fetchJobDepartments(): Promise<CustomerJobDepartment[]> {
  const snap = await getDocs(collection(db, "customer_job_departments"));
  return snap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, ...data, created_at: ts(data["created_at"]) } as CustomerJobDepartment;
  });
}

export async function createCustomerJob(
  input: Partial<CustomerJob> & { created_by: string; customer_name: string; project_title: string },
  departmentIds: string[],
): Promise<string> {
  const now = serverTimestamp();
  const { id: _ignore, ...data } = input as CustomerJob & { id?: string };
  const ref2 = await addDoc(collection(db, "customer_jobs"), {
    ...data,
    status: data.status ?? "draft",
    created_at: now,
    updated_at: now,
  });
  const jobId = ref2.id;

  if (departmentIds.length) {
    await Promise.all(
      departmentIds.map((department_id) =>
        addDoc(collection(db, "customer_job_departments"), {
          job_id: jobId,
          department_id,
          status: "pending",
          created_at: now,
        }),
      ),
    );
  }
  return jobId;
}

export async function updateCustomerJob(id: string, patch: Partial<CustomerJob>) {
  await updateDoc(doc(db, "customer_jobs", id), { ...patch, updated_at: serverTimestamp() });
}

export async function deleteCustomerJob(id: string) {
  // Also delete associated department links
  const q = query(collection(db, "customer_job_departments"), where("job_id", "==", id));
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  await deleteDoc(doc(db, "customer_jobs", id));
}

export async function setJobDepartmentStatus(id: string, status: string) {
  await updateDoc(doc(db, "customer_job_departments", id), { status });
}

/**
 * Applies deadline expiry across all tasks.
 * Marks tasks as "expired" if they are past due and not done.
 * Sends notifications to assigned employee, dept admin, and all super admins.
 * Returns the count of expired tasks.
 */
export async function runTaskExpiry(): Promise<number> {
  const todayStr = new Date().toISOString().split("T")[0];
  const today = todayStr ?? new Date().toISOString().slice(0, 10);
  const q = query(
    collection(db, "tasks"),
    where("status", "in", ["pending", "in_progress", "blocked"]),
  );
  const snap = await getDocs(q);
  const toExpire = snap.docs.filter((d) => {
    const due = d.data()["due_date"] as string | null | undefined;
    return due && due < today;
  });

  if (toExpire.length === 0) return 0;

  const { addDoc, collection: col, serverTimestamp: sts } = await import("firebase/firestore");

  await Promise.all(
    toExpire.map(async (d) => {
      const data = d.data();
      const ownerId = data["owner_id"] as string | null;
      const deptId = data["department_id"] as string | null;
      const title = data["title"] as string ?? "A task";

      // Mark expired
      await updateDoc(d.ref, { status: "expired", updated_at: serverTimestamp() });

      // Notify the assigned employee
      if (ownerId) {
        await addDoc(col(db, "notifications"), {
          user_id: ownerId,
          actor_id: null,
          department_id: deptId,
          title: "Task expired",
          body: `"${title}" has passed its deadline and was marked expired.`,
          type: "warning",
          audience: "personal",
          read: false,
          created_at: sts(),
        });
      }

      // Notify dept admin
      if (deptId) {
        await addDoc(col(db, "notifications"), {
          user_id: null,
          actor_id: null,
          department_id: deptId,
          title: "Task expired in your department",
          body: `"${title}" has passed its deadline.`,
          type: "warning",
          audience: "department",
          read: false,
          created_at: sts(),
        });
      }

      // Notify all super admins
      await addDoc(col(db, "notifications"), {
        user_id: null,
        actor_id: null,
        department_id: deptId,
        title: "Task expired",
        body: `"${title}" has passed its deadline.`,
        type: "warning",
        audience: "admin",
        read: false,
        created_at: sts(),
      });
    }),
  );

  return toExpire.length;
}
