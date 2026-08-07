import { supabase } from "@/integrations/supabase/client";
import type { CustomerJob, CustomerJobDepartment } from "./types";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export async function fetchCustomerJobs() {
  return unwrap<CustomerJob[]>(
    (await supabase
      .from("customer_jobs")
      .select("*")
      .order("created_at", { ascending: false })) as never,
  );
}

export async function fetchJobDepartments() {
  return unwrap<CustomerJobDepartment[]>(
    (await supabase.from("customer_job_departments").select("*")) as never,
  );
}

export async function createCustomerJob(
  input: Partial<CustomerJob> & { created_by: string; customer_name: string; project_title: string },
  departmentIds: string[],
) {
  const { data, error } = await supabase
    .from("customer_jobs")
    .insert(input as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const jobId = (data as unknown as { id: string }).id;
  if (departmentIds.length) {
    const { error: linkError } = await supabase
      .from("customer_job_departments")
      .insert(departmentIds.map((department_id) => ({ job_id: jobId, department_id })) as never);
    if (linkError) throw new Error(linkError.message);
  }
  return jobId;
}

export async function updateCustomerJob(id: string, patch: Partial<CustomerJob>) {
  const { error } = await supabase
    .from("customer_jobs")
    .update(patch as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCustomerJob(id: string) {
  const { error } = await supabase.from("customer_jobs").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setJobDepartmentStatus(id: string, status: string) {
  const { error } = await supabase
    .from("customer_job_departments")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Applies deadline expiry across the company; safe to call on every app load. */
export async function runTaskExpiry() {
  const { data } = await supabase.rpc("expire_overdue_tasks" as never);
  return (data as unknown as number) ?? 0;
}
