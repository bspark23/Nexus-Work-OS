import { useAuth } from "./useAuth";
import type { Scope } from "@/lib/scope";

/** Role + department context used to scope every list the user can see. */
export function useScope(): Scope {
  const { user, isAdmin, isDeptAdmin, departmentId } = useAuth();
  return {
    userId: user?.id ?? null,
    departmentId,
    isSuperAdmin: isAdmin,
    isDeptAdmin,
  };
}
