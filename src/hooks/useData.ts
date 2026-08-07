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
import { fetchCustomerJobs, fetchJobDepartments, fetchSavedFile } from "@/lib/jobs-api";
import { useAuth } from "./useAuth";
import { SALES_DEPARTMENT } from "@/lib/constants";

export const useDepartments = () =>
  useQuery({ queryKey: ["departments"], queryFn: fetchDepartments });

export const useProfiles = (enabled = true) =>
  useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles, enabled });

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

/** Name of the department the signed-in user belongs to. */
export function useMyDepartment() {
  const { departmentId } = useAuth();
  const { data: departments = [] } = useDepartments();
  const department = departments.find((d) => d.id === departmentId) ?? null;
  return { department, departmentId, isSales: department?.name === SALES_DEPARTMENT };
}
