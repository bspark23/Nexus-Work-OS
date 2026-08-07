import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const SUPER_ADMIN_SEED = {
  fullName: "Mbata Blessing",
  username: "mbatablessing",
  email: "mbatablessing@nexus-workos.internal",
  password: "Admin12345@",
};

type Role = "super_admin" | "admin" | "employee";

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

/** Idempotently guarantees the pre-configured Super Admin account exists. */
export async function ensureSeedSuperAdmin() {
  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .limit(1);
  if (existing && existing.length > 0) return { created: false as const };

  let userId: string;
  const found = await findUserByEmail(SUPER_ADMIN_SEED.email);
  if (found) {
    userId = found.id;
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: SUPER_ADMIN_SEED.password,
      email_confirm: true,
    });
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_SEED.email,
      password: SUPER_ADMIN_SEED.password,
      email_confirm: true,
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create Super Admin");
    userId = data.user.id;
  }

  await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name: SUPER_ADMIN_SEED.fullName,
      username: SUPER_ADMIN_SEED.username,
      email: SUPER_ADMIN_SEED.email,
      job_title: "Super Administrator",
      status: "active",
    } as never,
    { onConflict: "id" },
  );

  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "super_admin" } as never);

  return { created: true as const };
}

/** Throws unless the given user id currently holds the super_admin role. */
export async function assertSuperAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (role !== "super_admin") throw new Error("Forbidden: Super Admin access required");
}

/** Throws unless the caller is a super admin, or a department admin of `departmentId`. */
export async function assertDeptManager(userId: string, departmentId: string | null) {
  const { data: roleRow } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  const role = (roleRow as { role?: string } | null)?.role;
  if (role === "super_admin") return;
  if (role !== "admin") throw new Error("Forbidden: admin access required");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("department_id")
    .eq("id", userId)
    .maybeSingle();
  const mine = (profile as { department_id?: string | null } | null)?.department_id ?? null;
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
  jobTitle?: string | null | undefined;
  role: Role;
}) {
  const authEmail = `${input.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "")}@nexus-workos.internal`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: authEmail,
    password: input.password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(error?.message ?? "Could not create the user");
  const userId = data.user.id;

  const { error: profileError } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    full_name: input.fullName,
    username: input.username.trim().toLowerCase(),
    email: input.email || authEmail,
    department_id: input.departmentId,
    job_title: input.jobTitle ?? null,
    status: "active",
  } as never);
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: input.role } as never);
  return { userId, loginUsername: input.username.trim().toLowerCase() };
}

export async function setUserRole(targetId: string, role: Role) {
  if (role !== "super_admin") {
    const { data: supers } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "super_admin");
    const ids = ((supers ?? []) as { user_id: string }[]).map((r) => r.user_id);
    if (ids.length <= 1 && ids.includes(targetId)) {
      throw new Error("The company must always keep at least one Super Admin");
    }
  }
  await supabaseAdmin.from("user_roles").delete().eq("user_id", targetId);
  const { error } = await supabaseAdmin
    .from("user_roles")
    .insert({ user_id: targetId, role } as never);
  if (error) throw new Error(error.message);
}

export async function setUserStatus(targetId: string, status: "active" | "suspended") {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ status } as never)
    .eq("id", targetId);
  if (error) throw new Error(error.message);
  await supabaseAdmin.auth.admin.updateUserById(targetId, {
    ban_duration: status === "suspended" ? "876000h" : "none",
  });
}

export async function removeUser(targetId: string, callerId: string) {
  if (targetId === callerId) throw new Error("You cannot delete your own account");
  const { data: supers } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin");
  const ids = ((supers ?? []) as { user_id: string }[]).map((r) => r.user_id);
  if (ids.includes(targetId) && ids.length <= 1) {
    throw new Error("The company must always keep at least one Super Admin");
  }
  const { error } = await supabaseAdmin.auth.admin.deleteUser(targetId);
  if (error) throw new Error(error.message);
}

export async function updateManagedProfile(
  targetId: string,
  patch: {
    full_name?: string | undefined;
    email?: string | undefined;
    department_id?: string | null | undefined;
    job_title?: string | null | undefined;
  },
) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(patch as never)
    .eq("id", targetId);
  if (error) throw new Error(error.message);
}
