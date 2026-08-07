import { adminAuth, adminDb } from "@/integrations/firebase/admin.server";
import type { AppRole } from "./types";

export const SUPER_ADMIN_SEED = {
  fullName: "Mbata Blessing",
  username: "mbatablessing",
  email: "mbatablessing@nexus-workos.internal",
  password: "Admin12345@",
};

type Role = AppRole;

async function findUserByEmail(email: string) {
  try {
    return await adminAuth.getUserByEmail(email);
  } catch {
    return null;
  }
}

/** Idempotently guarantees the pre-configured Super Admin account exists. */
export async function ensureSeedSuperAdmin() {
  let userId: string;
  let created = false;

  const found = await findUserByEmail(SUPER_ADMIN_SEED.email);
  if (found) {
    userId = found.uid;
  } else {
    const userRecord = await adminAuth.createUser({
      email: SUPER_ADMIN_SEED.email,
      password: SUPER_ADMIN_SEED.password,
      displayName: SUPER_ADMIN_SEED.fullName,
      emailVerified: true,
    });
    userId = userRecord.uid;
    created = true;
  }

  // Upsert profile
  await adminDb.collection("profiles").doc(userId).set(
    {
      id: userId,
      full_name: SUPER_ADMIN_SEED.fullName,
      username: SUPER_ADMIN_SEED.username,
      email: SUPER_ADMIN_SEED.email,
      job_title: "Super Administrator",
      status: "active",
      department_id: null,
      avatar_url: null,
      bio: null,
      phone: null,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    { merge: true },
  );

  // Set role (document keyed by userId for easy lookup)
  await adminDb.collection("user_roles").doc(userId).set({ role: "super_admin", user_id: userId });

  return { created };
}

/** Throws unless the given user id currently holds the super_admin role. */
export async function assertSuperAdmin(userId: string) {
  const snap = await adminDb.collection("user_roles").doc(userId).get();
  const role = snap.data()?.["role"] as string | undefined;
  if (role !== "super_admin") throw new Error("Forbidden: Super Admin access required");
}

/** Throws unless the caller is a super admin, or a department admin of `departmentId`. */
export async function assertDeptManager(userId: string, departmentId: string | null) {
  const snap = await adminDb.collection("user_roles").doc(userId).get();
  const role = snap.data()?.["role"] as string | undefined;
  if (role === "super_admin") return;
  if (role !== "admin") throw new Error("Forbidden: admin access required");
  const profileSnap = await adminDb.collection("profiles").doc(userId).get();
  const mine = (profileSnap.data()?.["department_id"] as string | null) ?? null;
  if (!departmentId || mine !== departmentId) {
    throw new Error("Forbidden: this department is not yours");
  }
}

export async function createManagedUser(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  departmentId: string | null;
  jobTitle?: string | null;
  role: Role;
}): Promise<{ userId: string; loginUsername: string }> {
  const authEmail = `${input.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@nexus-workos.internal`;

  const userRecord = await adminAuth.createUser({
    email: authEmail,
    password: input.password,
    displayName: input.fullName,
    emailVerified: true,
  });
  const userId = userRecord.uid;

  try {
    await adminDb.collection("profiles").doc(userId).set({
      id: userId,
      full_name: input.fullName,
      username: input.username.trim().toLowerCase(),
      email: input.email || authEmail,
      department_id: input.departmentId,
      job_title: input.jobTitle ?? null,
      status: "active",
      avatar_url: null,
      bio: null,
      phone: null,
      last_seen_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    });
    await adminDb.collection("user_roles").doc(userId).set({ role: input.role, user_id: userId });
  } catch (err) {
    await adminAuth.deleteUser(userId);
    throw err;
  }

  return { userId, loginUsername: input.username.trim().toLowerCase() };
}

export async function setUserRole(targetId: string, role: Role) {
  if (role !== "super_admin") {
    const snap = await adminDb.collection("user_roles").where("role", "==", "super_admin").get();
    const ids = snap.docs.map((d) => d.id);
    if (ids.length <= 1 && ids.includes(targetId)) {
      throw new Error("The company must always keep at least one Super Admin");
    }
  }
  await adminDb.collection("user_roles").doc(targetId).set({ role, user_id: targetId });
}

export async function setUserStatus(targetId: string, status: "active" | "suspended") {
  await adminDb.collection("profiles").doc(targetId).update({ status });
  await adminAuth.updateUser(targetId, { disabled: status === "suspended" });
}

export async function removeUser(targetId: string, callerId: string) {
  if (targetId === callerId) throw new Error("You cannot delete your own account");
  const snap = await adminDb.collection("user_roles").where("role", "==", "super_admin").get();
  const ids = snap.docs.map((d) => d.id);
  if (ids.includes(targetId) && ids.length <= 1) {
    throw new Error("The company must always keep at least one Super Admin");
  }
  await adminAuth.deleteUser(targetId);
  await adminDb.collection("profiles").doc(targetId).delete();
  await adminDb.collection("user_roles").doc(targetId).delete();
}

export async function updateManagedProfile(
  targetId: string,
  patch: {
    full_name?: string;
    email?: string;
    department_id?: string | null;
    job_title?: string | null;
  },
) {
  await adminDb.collection("profiles").doc(targetId).update(patch);
}
