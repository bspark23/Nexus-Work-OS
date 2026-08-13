import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useProfiles, useRoles } from "./useData";

/**
 * Returns true when the current signed-in user is the original (first) Super Admin.
 * The original Super Admin is the earliest-created profile with role `super_admin`.
 */
export function useOriginalSuperAdmin() {
  const { user } = useAuth();
  const { data: people = [] } = useProfiles();
  const { data: roles = [] } = useRoles();

  return useMemo(() => {
    if (!user) return false;
    const roleMap = Object.fromEntries(roles.map((r: any) => [r.user_id, r.role]));
    const superAdmins = people.filter((p: any) => roleMap[p.id] === "super_admin");
    if (!superAdmins.length) return false;
    const sorted = [...superAdmins].sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    return sorted[0]?.id === user.id;
  }, [user, people, roles]);
}

export default useOriginalSuperAdmin;
