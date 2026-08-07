import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["super_admin", "admin", "employee"]);

/** Public + idempotent: creates the pre-configured Super Admin when none exists yet. */
export const ensureSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { ensureSeedSuperAdmin } = await import("./admin.server");
  return ensureSeedSuperAdmin();
});

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        fullName: z.string().min(2),
        username: z.string().min(2),
        email: z.string().email().or(z.literal("")),
        password: z.string().min(8),
        departmentId: z.string().uuid().nullable(),
        jobTitle: z.string().nullable().optional(),
        role: roleSchema,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin, createManagedUser } = await import("./admin.server");
    await assertSuperAdmin(context.userId);
    return createManagedUser(data);
  });

export const adminSetRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), role: roleSchema }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin, setUserRole } = await import("./admin.server");
    await assertSuperAdmin(context.userId);
    await setUserRole(data.userId, data.role);
    return { ok: true };
  });

export const adminSetStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({ userId: z.string().uuid(), status: z.enum(["active", "suspended"]) })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin, setUserStatus } = await import("./admin.server");
    await assertSuperAdmin(context.userId);
    await setUserStatus(data.userId, data.status);
    return { ok: true };
  });

export const adminUpdateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        fullName: z.string().min(2),
        email: z.string().email().or(z.literal("")),
        departmentId: z.string().uuid().nullable(),
        jobTitle: z.string().nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin, updateManagedProfile } = await import("./admin.server");
    await assertSuperAdmin(context.userId);
    await updateManagedProfile(data.userId, {
      full_name: data.fullName,
      email: data.email || undefined,
      department_id: data.departmentId,
      job_title: data.jobTitle ?? null,
    });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertSuperAdmin, removeUser } = await import("./admin.server");
    await assertSuperAdmin(context.userId);
    await removeUser(data.userId, context.userId);
    return { ok: true };
  });
