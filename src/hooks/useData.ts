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
