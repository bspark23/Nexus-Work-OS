import { useQuery } from "@tanstack/react-query";
import {
  fetchActivities,
  fetchAttachments,
  fetchDepartments,
  fetchNotifications,
  fetchProfiles,
  fetchProjects,
  fetchReports,
  fetchRoles,
  fetchTasks,
} from "@/lib/api";
import {
  fetchCustomerJobs,
  fetchJobDepartments,
  fetchSavedFile,
  fetchAllSavedFiles,
  fetchSharedTracker,
} from "@/lib/jobs-api";
import { useAuth } from "./useAuth";
import { SALES_DEPARTMENT } from "@/lib/constants";

export const useDepartments = () =>
  useQuery({
    queryKey: ["departments"],
    queryFn: fetchDepartments,
    staleTime: 15 * 60_000, // Departments almost never change
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    gcTime: 60 * 60_000, // Keep for an hour
  });

export const useProfiles = (enabled = true) =>
  useQuery({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    enabled,
    staleTime: 5 * 60_000, // 5 min stale
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    gcTime: 15 * 60_000,
  });

export const useRoles = (enabled = true) =>
  useQuery({ queryKey: ["user_roles"], queryFn: fetchRoles, enabled });

export const useProjects = (enabled = true) =>
  useQuery({ queryKey: ["projects"], queryFn: () => fetchProjects(), enabled });

export const useTasks = (enabled = true) =>
  useQuery({ queryKey: ["tasks"], queryFn: () => fetchTasks(), enabled });

export const useReports = (enabled = true) =>
  useQuery({ queryKey: ["reports"], queryFn: () => fetchReports(), enabled });

export const useActivities = (enabled = true) =>
  useQuery({ queryKey: ["activities"], queryFn: () => fetchActivities(), enabled });

export const useNotifications = (enabled = true) =>
  useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications, enabled });

export const useAttachments = (enabled = true) =>
  useQuery({ queryKey: ["attachments"], queryFn: fetchAttachments, enabled });

export const useCustomerJobs = (enabled = true) =>
  useQuery({ queryKey: ["customer_jobs"], queryFn: fetchCustomerJobs, enabled });

export const useJobDepartments = (enabled = true) =>
  useQuery({
    queryKey: ["customer_job_departments"],
    queryFn: fetchJobDepartments,
    enabled,
  });

export const useSavedFile = (userId: string | null) =>
  useQuery({
    queryKey: ["saved_file", userId],
    queryFn: () => fetchSavedFile(userId!),
    enabled: !!userId,
  });

export const useAllSavedFiles = (enabled = true) =>
  useQuery({
    queryKey: ["saved_files_all"],
    queryFn: fetchAllSavedFiles,
    enabled,
    staleTime: 5 * 60_000, // 5 minutes — data stays fresh longer to reduce DB hits
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't re-fetch just because component remounted (nav back)
    gcTime: 10 * 60_000, // Keep in cache for 10 minutes
  });

export const useSharedTracker = (enabled = true) =>
  useQuery({
    queryKey: ["shared_tracker"],
    queryFn: fetchSharedTracker,
    enabled,
    staleTime: 5 * 60_000, // treat data as fresh for 5 minutes
    refetchInterval: false, // NO automatic polling — too expensive for large sheets
    // Team members can hit the Refresh button if they need latest
    refetchOnWindowFocus: false, // don't re-fetch every time user clicks back on the window
    refetchOnMount: false, // Don't re-fetch just because component remounted
    gcTime: 15 * 60_000, // Keep in cache for 15 minutes
  });

export const useProfilesLight = (enabled = true) =>
  useQuery({
    queryKey: ["profiles_light"],
    queryFn: fetchProfiles,
    enabled,
    staleTime: 10 * 60_000, // Profiles rarely change - 10 min stale time
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    gcTime: 30 * 60_000,
    select: (data) =>
      data.map((p) => ({ id: p.id, full_name: p.full_name, department_id: p.department_id })),
  });

/** Name of the department the signed-in user belongs to. */
export function useMyDepartment() {
  const { departmentId } = useAuth();
  const { data: departments = [] } = useDepartments();
  const department = departments.find((d) => d.id === departmentId) ?? null;
  return { department, departmentId, isSales: department?.name === SALES_DEPARTMENT };
}
