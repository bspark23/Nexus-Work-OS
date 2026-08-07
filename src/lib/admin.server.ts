/**
 * Admin server operations.
 * All operations now handled client-side via Firestore directly.
 * The firebase-admin SDK is not used in this deployment.
 */
import type { AppRole } from "./types";

export const SUPER_ADMIN_SEED = {
  fullName: "Mbata Blessing",
  username: "mbatablessing",
  email: "mbatablessing@nexus-workos.internal",
  password: "Admin12345@",
};

/** No-op: Super Admin is created via public registration first-run flow */
export async function ensureSeedSuperAdmin() {
  return { created: false, message: "Use the Register tab on first run to create Super Admin" };
}

export async function assertSuperAdmin(_userId: string) {
  // Validation is done client-side via Firestore role check
}

export async function createManagedUser(_input: {
  fullName: string; username: string; email: string;
  password: string; departmentId: string | null;
  jobTitle?: string | null; role: AppRole;
}) {
  throw new Error("Use the Admin Panel UI to create users");
}

export async function setUserRole(_targetId: string, _role: AppRole) {
  throw new Error("Use the Admin Panel UI to change roles");
}

export async function setUserStatus(_targetId: string, _status: "active" | "suspended") {
  throw new Error("Use the Admin Panel UI to change status");
}

export async function removeUser(_targetId: string, _callerId: string) {
  throw new Error("Use the Admin Panel UI to remove users");
}

export async function updateManagedProfile(_targetId: string, _patch: object) {
  throw new Error("Use the Admin Panel UI to update profiles");
}

export async function assertDeptManager(_userId: string, _departmentId: string | null) {
  // No-op
}
