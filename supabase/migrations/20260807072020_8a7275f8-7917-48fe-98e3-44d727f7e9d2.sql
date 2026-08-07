-- 1. Role enum gains 'admin' (value used only via ::text comparisons in this migration)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- 2. Helper functions -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_dept_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.my_dept()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

-- true when caller is super admin, or a department admin of the given department
CREATE OR REPLACE FUNCTION public.can_manage_dept(_dept uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR (_dept IS NOT NULL AND public.is_dept_admin() AND _dept = public.my_dept());
$$;

-- public registration always yields an employee
CREATE OR REPLACE FUNCTION public.claim_initial_role()
RETURNS app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assigned public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO assigned FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF assigned IS NOT NULL THEN RETURN assigned; END IF;
  assigned := 'employee';
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), assigned) ON CONFLICT DO NOTHING;
  RETURN assigned;
END; $$;

-- 3. Departments ------------------------------------------------------------
INSERT INTO public.departments (name, description)
SELECT v.name, v.description FROM (VALUES
  ('Sales', 'Customer intake, job requests and client relations'),
  ('Marketing', 'Campaigns, growth and brand communication'),
  ('UI/UX', 'Product design, wireframes and user experience'),
  ('Mobile Development', 'iOS and Android application development')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM public.departments d WHERE d.name = v.name);

-- 4. Tasks ------------------------------------------------------------------
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS expected_delivery_date date,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS progress integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_job_id uuid;

-- 5. Customer jobs ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL,
  company_name text,
  contact_info text,
  project_title text NOT NULL,
  project_description text,
  requested_services text,
  expected_delivery_date date,
  notes text,
  source_file_name text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_jobs TO authenticated;
GRANT ALL ON public.customer_jobs TO service_role;
ALTER TABLE public.customer_jobs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_job_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.customer_jobs(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'received',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, department_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_job_departments TO authenticated;
GRANT ALL ON public.customer_job_departments TO service_role;
ALTER TABLE public.customer_job_departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_customer_job_id_fkey;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_customer_job_id_fkey
  FOREIGN KEY (customer_job_id) REFERENCES public.customer_jobs(id) ON DELETE SET NULL;

CREATE TRIGGER t_customer_jobs_upd BEFORE UPDATE ON public.customer_jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- job visibility: creator, super admins, and admins of a receiving department
CREATE OR REPLACE FUNCTION public.can_see_job(_job_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin()
      OR EXISTS (SELECT 1 FROM public.customer_jobs j WHERE j.id = _job_id AND j.created_by = auth.uid())
      OR (public.is_dept_admin() AND EXISTS (
            SELECT 1 FROM public.customer_job_departments cjd
            WHERE cjd.job_id = _job_id AND cjd.department_id = public.my_dept()));
$$;

CREATE POLICY "customer_jobs select" ON public.customer_jobs FOR SELECT TO authenticated
  USING (public.can_see_job(id));
CREATE POLICY "customer_jobs insert" ON public.customer_jobs FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "customer_jobs update" ON public.customer_jobs FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());
CREATE POLICY "customer_jobs delete" ON public.customer_jobs FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "cjd select" ON public.customer_job_departments FOR SELECT TO authenticated
  USING (public.can_see_job(job_id));
CREATE POLICY "cjd insert" ON public.customer_job_departments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.customer_jobs j WHERE j.id = job_id AND (j.created_by = auth.uid() OR public.is_admin())));
CREATE POLICY "cjd update" ON public.customer_job_departments FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.is_dept_admin() AND department_id = public.my_dept()));
CREATE POLICY "cjd delete" ON public.customer_job_departments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.customer_jobs j WHERE j.id = job_id AND (j.created_by = auth.uid() OR public.is_admin())));

-- 6. Notifications gain a department scope ----------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (audience = 'admin' AND public.is_admin())
    OR (audience = 'department' AND public.is_dept_admin() AND department_id = public.my_dept())
  );
DROP POLICY IF EXISTS "notifications update" ON public.notifications;
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR (audience = 'admin' AND public.is_admin())
    OR (audience = 'department' AND public.is_dept_admin() AND department_id = public.my_dept())
  );

-- 7. Profiles ---------------------------------------------------------------
DROP POLICY IF EXISTS "profiles readable by members" ON public.profiles;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
    OR (public.is_dept_admin() AND department_id = public.my_dept())
    OR EXISTS (SELECT 1 FROM public.tasks t WHERE t.owner_id = auth.uid() AND t.assigned_by = profiles.id)
  );

DROP POLICY IF EXISTS "profiles update own or admin" ON public.profiles;
CREATE POLICY "profiles update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin() OR (public.is_dept_admin() AND department_id = public.my_dept()));

-- 8. user_roles -------------------------------------------------------------
DROP POLICY IF EXISTS "roles readable" ON public.user_roles;
CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin() OR public.is_dept_admin());
CREATE POLICY "roles managed by super admin" ON public.user_roles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 9. Departments: super admin only for writes (already is_admin based) ------
-- unchanged

-- 10. Projects --------------------------------------------------------------
DROP POLICY IF EXISTS "projects select" ON public.projects;
CREATE POLICY "projects select" ON public.projects FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "projects update" ON public.projects;
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "projects delete" ON public.projects;
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));

-- 11. Tasks RLS: employees may not create tasks -----------------------------
DROP POLICY IF EXISTS "tasks select" ON public.tasks;
CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR assigned_by = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "tasks insert" ON public.tasks;
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated
  WITH CHECK (assigned_by = auth.uid() AND public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "tasks update" ON public.tasks;
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "tasks delete" ON public.tasks;
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated
  USING (public.can_manage_dept(department_id));

-- 12. Reports ---------------------------------------------------------------
DROP POLICY IF EXISTS "reports select" ON public.reports;
CREATE POLICY "reports select" ON public.reports FOR SELECT TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "reports update" ON public.reports;
CREATE POLICY "reports update" ON public.reports FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "reports delete" ON public.reports;
CREATE POLICY "reports delete" ON public.reports FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_admin());

-- 13. Attachments -----------------------------------------------------------
ALTER TABLE public.attachments
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS customer_job_id uuid REFERENCES public.customer_jobs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "attachments select" ON public.attachments;
CREATE POLICY "attachments select" ON public.attachments FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));
DROP POLICY IF EXISTS "attachments delete" ON public.attachments;
CREATE POLICY "attachments delete" ON public.attachments FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.can_manage_dept(department_id));

-- 14. Activities ------------------------------------------------------------
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
DROP POLICY IF EXISTS "activities select" ON public.activities;
CREATE POLICY "activities select" ON public.activities FOR SELECT TO authenticated
  USING (actor_id = auth.uid() OR public.can_manage_dept(department_id));

-- 15. Automatic task expiry -------------------------------------------------
CREATE OR REPLACE FUNCTION public.expire_overdue_tasks()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN
    UPDATE public.tasks t SET status = 'expired', updated_at = now()
    WHERE t.due_date IS NOT NULL
      AND t.due_date < CURRENT_DATE
      AND t.status NOT IN ('done', 'expired')
    RETURNING t.id, t.title, t.owner_id, t.department_id
  LOOP
    n := n + 1;
    INSERT INTO public.notifications (user_id, title, body, type, audience, department_id)
    VALUES (r.owner_id, 'Task expired', r.title || ' passed its deadline', 'task_expired', 'personal', r.department_id);
    INSERT INTO public.notifications (title, body, type, audience, department_id)
    VALUES ('Task expired', r.title || ' passed its deadline', 'task_expired', 'department', r.department_id);
    INSERT INTO public.notifications (title, body, type, audience, department_id)
    VALUES ('Task expired', r.title || ' passed its deadline', 'task_expired', 'admin', r.department_id);
  END LOOP;
  RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.expire_overdue_tasks() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.expire_overdue_tasks() TO authenticated, service_role;

-- notifications insert stays open to authenticated (app writes role-aware rows)
DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);