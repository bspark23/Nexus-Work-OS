export type AppRole = "super_admin" | "admin" | "employee";

export type Department = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  username: string;
  email: string;
  department_id: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone: string | null;
  job_title: string | null;
  status: string;
  last_seen_at: string;
  created_at: string;
};

export type Project = {
  id: string;
  owner_id: string;
  title: string;
  project_type: string | null;
  description: string | null;
  department_id: string | null;
  start_date: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  progress: number;
  current_task: string | null;
  completed_tasks: string | null;
  challenges: string | null;
  delay_reason: string | null;
  developer_notes: string | null;
  github_url: string | null;
  live_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Task = {
  id: string;
  owner_id: string;           // person the task is assigned TO
  assigned_to: string | null; // explicit assignee (same as owner_id)
  project_id: string | null;
  customer_job_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;             // pending | in_progress | blocked | done | expired
  progress: number;
  start_date: string | null;
  due_date: string | null;
  expected_delivery_date: string | null;
  completed_at: string | null;
  assigned_by: string | null;
  department_id: string | null;
  notes: string | null;
  // Fields filled by the assignee when submitting completion / update
  completion_note: string | null;   // "I have finished…"
  completion_link: string | null;   // optional URL to deliverable
  block_reason: string | null;      // required when status = blocked
  review_status: string | null;     // null | "pending_review" | "approved" | "rejected"
  reviewer_feedback: string | null; // feedback from the assigner
  created_at: string;
  updated_at: string;
};

export type ReportProjectRow = {
  s_no: string;
  brand_name: string;
  project_type: string;
  date_received: string;
  received_from: string;
  time_received: string;
  date_delivered: string;
  delivered_to: string;
  time_delivered: string;
};

export type Report = {
  id: string;
  author_id: string;
  department_id: string | null;
  report_type: string;
  title: string;
  summary: string | null;
  completed_work: string | null;
  challenges: string | null;
  achievements: string | null;
  next_steps: string | null;
  report_date: string;
  status: string;
  /** Optional link to an external resource (Google Drive, GitHub, Figma, etc.) */
  report_link: string | null;
  /** Optional link label shown instead of the raw URL */
  report_link_label: string | null;
  /** Optional uploaded file stored as base64 data URL */
  attached_file: string | null;
  attached_file_name: string | null;
  // ── iBrand Weekly Performance Report structured fields ────────────
  // INDIVIDUAL INFORMATION
  report_employee_name: string | null;
  report_designation: string | null;
  report_week_ending: string | null;
  report_supervisor: string | null;
  // PROJECTS TABLE
  report_projects: ReportProjectRow[] | null;
  // PERFORMANCE SUMMARY
  perf_projects_received: string | null;
  perf_projects_delivered: string | null;
  perf_projects_ongoing: string | null;
  perf_pending_feedback: string | null;
  perf_remark: string | null;
  // SELF EVALUATION
  self_eval_rating: "excellent" | "good" | "fair" | "sum_optimal" | "poor" | string | null;
  self_eval_strategies: string | null;
  self_eval_improvement: string | null;
  self_eval_upcoming: string | null;
  self_eval_challenges: string | null;
  // SUPERVISOR
  supervisor_remark: string | null;
  supervisor_sign_date: string | null;
  created_at: string;
  updated_at: string;
};

export type Attachment = {
  id: string;
  owner_id: string;
  project_id: string | null;
  report_id: string | null;
  task_id: string | null;
  customer_job_id: string | null;
  department_id: string | null;
  file_name: string;
  file_path: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  kind: string;
  created_at: string;
};

export type Activity = {
  id: string;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  department_id: string | null;
  description: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  department_id: string | null;
  title: string;
  body: string | null;
  type: string;
  audience: string;
  read: boolean;
  created_at: string;
};

export type CustomerJob = {
  id: string;
  created_by: string;
  customer_name: string;
  company_name: string | null;
  contact_info: string | null;
  project_title: string;
  project_description: string | null;
  requested_services: string | null;
  expected_delivery_date: string | null;
  notes: string | null;
  source_file_name: string | null;
  assigned_employee_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type CustomerJobDepartment = {
  id: string;
  job_id: string;
  department_id: string;
  status: string;
  created_at: string;
};
