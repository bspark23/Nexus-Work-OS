
CREATE TYPE public.app_role AS ENUM ('super_admin','employee');

CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  username text NOT NULL UNIQUE,
  email text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  avatar_url text,
  bio text,
  phone text,
  job_title text,
  status text NOT NULL DEFAULT 'active',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

-- first registered user becomes super admin, everyone else an employee
CREATE OR REPLACE FUNCTION public.claim_initial_role()
RETURNS public.app_role LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE assigned public.app_role;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT role INTO assigned FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
  IF assigned IS NOT NULL THEN RETURN assigned; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'super_admin') THEN
    assigned := 'super_admin';
  ELSE
    assigned := 'employee';
  END IF;
  INSERT INTO public.user_roles(user_id, role) VALUES (auth.uid(), assigned)
  ON CONFLICT DO NOTHING;
  RETURN assigned;
END; $$;

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  project_type text,
  description text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  start_date date,
  due_date date,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'not_started',
  progress int NOT NULL DEFAULT 0,
  current_task text,
  completed_tasks text,
  challenges text,
  delay_reason text,
  developer_notes text,
  github_url text,
  live_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'pending',
  due_date date,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  report_type text NOT NULL DEFAULT 'daily',
  title text NOT NULL,
  summary text,
  completed_work text,
  challenges text,
  achievements text,
  next_steps text,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  file_size bigint,
  kind text NOT NULL DEFAULT 'file',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activities TO authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'info',
  audience text NOT NULL DEFAULT 'admin',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- policies
CREATE POLICY "departments readable" ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments admin insert" ON public.departments FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "departments admin update" ON public.departments FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "departments admin delete" ON public.departments FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "profiles readable by members" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles update own or admin" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles delete admin" ON public.profiles FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "roles readable" ON public.user_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "projects select" ON public.projects FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "projects insert" ON public.projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects update" ON public.projects FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "projects delete" ON public.projects FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "tasks select" ON public.tasks FOR SELECT TO authenticated USING (owner_id = auth.uid() OR assigned_by = auth.uid() OR public.is_admin());
CREATE POLICY "tasks insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "tasks update" ON public.tasks FOR UPDATE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "tasks delete" ON public.tasks FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "reports select" ON public.reports FOR SELECT TO authenticated USING (author_id = auth.uid() OR public.is_admin());
CREATE POLICY "reports insert" ON public.reports FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
CREATE POLICY "reports update" ON public.reports FOR UPDATE TO authenticated USING (author_id = auth.uid() OR public.is_admin());
CREATE POLICY "reports delete" ON public.reports FOR DELETE TO authenticated USING (author_id = auth.uid() OR public.is_admin());

CREATE POLICY "attachments select" ON public.attachments FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_admin());
CREATE POLICY "attachments insert" ON public.attachments FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "attachments delete" ON public.attachments FOR DELETE TO authenticated USING (owner_id = auth.uid() OR public.is_admin());

CREATE POLICY "activities select" ON public.activities FOR SELECT TO authenticated USING (actor_id = auth.uid() OR public.is_admin());
CREATE POLICY "activities insert" ON public.activities FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

CREATE POLICY "notifications select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR (audience = 'admin' AND public.is_admin()));
CREATE POLICY "notifications insert" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR (audience = 'admin' AND public.is_admin()));

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER t_projects_upd BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_tasks_upd BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER t_reports_upd BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.departments(name, description) VALUES
  ('Web Development','Websites, web apps and platform engineering'),
  ('Video Team','Video production, editing and motion'),
  ('Graphic Design Team','Brand, print and digital design'),
  ('Social Media Team','Content, community and campaigns');

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reports;
ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.departments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
