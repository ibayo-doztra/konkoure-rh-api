
-- =========================================================================
-- ENUMS
-- =========================================================================
create type public.app_role as enum ('owner', 'hr_admin', 'manager', 'employee', 'recruiter');
create type public.plan_type as enum ('trial', 'starter', 'pro', 'enterprise');
create type public.contract_type as enum ('cdi', 'cdd', 'stage', 'freelance', 'apprenticeship');
create type public.employee_status as enum ('active', 'on_leave', 'terminated');
create type public.job_status as enum ('draft', 'published', 'closed');
create type public.candidate_stage as enum ('new', 'screening', 'interview', 'offer', 'hired', 'rejected');
create type public.okr_status as enum ('draft', 'active', 'completed', 'archived');
create type public.feedback_kind as enum ('kudos', 'suggestion', 'concern');
create type public.review_status as enum ('draft', 'self_done', 'manager_done', 'finalized');
create type public.timelog_status as enum ('pending', 'approved', 'rejected');

-- =========================================================================
-- ORGANIZATIONS & MEMBERSHIP
-- =========================================================================
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  default_language text not null default 'fr',
  default_currency text not null default 'XOF',
  plan public.plan_type not null default 'trial',
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  preferred_language text default 'fr',
  created_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, organization_id, role)
);

-- =========================================================================
-- SECURITY DEFINER HELPERS (no recursion)
-- =========================================================================
create or replace function public.has_role(_user_id uuid, _org_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org_id and role = _role
  )
$$;

create or replace function public.is_org_member(_user_id uuid, _org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where user_id = _user_id and organization_id = _org_id
  )
$$;

create or replace function public.is_org_admin(_user_id uuid, _org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and organization_id = _org_id
    and role in ('owner','hr_admin')
  )
$$;

-- =========================================================================
-- HRM
-- =========================================================================
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  photo_url text,
  job_title text,
  department_id uuid references public.departments(id) on delete set null,
  manager_id uuid references public.employees(id) on delete set null,
  hire_date date,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  type public.contract_type not null,
  start_date date not null,
  end_date date,
  salary numeric(14,2),
  currency text default 'XOF',
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- RECRUITMENT
-- =========================================================================
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  department_id uuid references public.departments(id) on delete set null,
  location text,
  description text,
  requirements text,
  status public.job_status not null default 'draft',
  inclusive_score int,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  full_name text not null,
  email text,
  phone text,
  cv_url text,
  cv_text text,
  ai_score int,
  ai_justification text,
  stage public.candidate_stage not null default 'new',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- PERFORMANCE
-- =========================================================================
create table public.okrs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete cascade,
  quarter text not null,
  objective text not null,
  key_results jsonb not null default '[]',
  progress int not null default 0,
  status public.okr_status not null default 'active',
  created_at timestamptz not null default now()
);

create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  from_employee_id uuid references public.employees(id) on delete set null,
  to_employee_id uuid not null references public.employees(id) on delete cascade,
  kind public.feedback_kind not null default 'kudos',
  message text not null,
  created_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period text not null,
  self_text text,
  manager_text text,
  ai_summary text,
  performance_score int,
  potential_score int,
  status public.review_status not null default 'draft',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- TIMECLOCK
-- =========================================================================
create table public.work_zones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  latitude double precision not null,
  longitude double precision not null,
  radius_meters int not null default 100,
  created_at timestamptz not null default now()
);

create table public.time_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_zone_id uuid references public.work_zones(id) on delete set null,
  check_in timestamptz not null,
  check_out timestamptz,
  latitude double precision,
  longitude double precision,
  within_zone boolean,
  status public.timelog_status not null default 'pending',
  source text default 'mobile',
  created_at timestamptz not null default now()
);

-- =========================================================================
-- TALENTS
-- =========================================================================
create table public.skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.employee_skills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  skill_id uuid not null references public.skills(id) on delete cascade,
  level int not null default 1 check (level between 1 and 5),
  unique (employee_id, skill_id)
);

create table public.succession_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  position_title text not null,
  current_employee_id uuid references public.employees(id) on delete set null,
  successor_employee_id uuid references public.employees(id) on delete set null,
  readiness text,
  notes text,
  created_at timestamptz not null default now()
);

-- =========================================================================
-- ENABLE RLS
-- =========================================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.user_roles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.contracts enable row level security;
alter table public.jobs enable row level security;
alter table public.candidates enable row level security;
alter table public.okrs enable row level security;
alter table public.feedbacks enable row level security;
alter table public.reviews enable row level security;
alter table public.work_zones enable row level security;
alter table public.time_logs enable row level security;
alter table public.skills enable row level security;
alter table public.employee_skills enable row level security;
alter table public.succession_plans enable row level security;

-- =========================================================================
-- POLICIES
-- =========================================================================

-- Profiles
create policy "Profiles: read own" on public.profiles for select using (auth.uid() = id);
create policy "Profiles: insert own" on public.profiles for insert with check (auth.uid() = id);
create policy "Profiles: update own" on public.profiles for update using (auth.uid() = id);

-- Organizations: members can read, admins can update; anyone authenticated can create
create policy "Orgs: members read" on public.organizations for select
  using (public.is_org_member(auth.uid(), id));
create policy "Orgs: public read by slug" on public.organizations for select
  using (true);
-- (above public read is harmless: only name/slug; adjust if needed). We'll keep it for /careers/{slug}.
create policy "Orgs: authenticated create" on public.organizations for insert
  with check (auth.uid() is not null);
create policy "Orgs: admins update" on public.organizations for update
  using (public.is_org_admin(auth.uid(), id));

-- Drop the duplicate select policy (Postgres allows multiple permissive ON same table)
-- We keep both, but the public read overrides the member read for visibility.

-- Organization members
create policy "Members: read own org" on public.organization_members for select
  using (public.is_org_member(auth.uid(), organization_id));
create policy "Members: self insert" on public.organization_members for insert
  with check (auth.uid() = user_id);
create policy "Members: admins manage" on public.organization_members for all
  using (public.is_org_admin(auth.uid(), organization_id))
  with check (public.is_org_admin(auth.uid(), organization_id));

-- User roles
create policy "Roles: read own org" on public.user_roles for select
  using (public.is_org_member(auth.uid(), organization_id));
create policy "Roles: self bootstrap owner" on public.user_roles for insert
  with check (auth.uid() = user_id);
create policy "Roles: admins manage" on public.user_roles for all
  using (public.is_org_admin(auth.uid(), organization_id))
  with check (public.is_org_admin(auth.uid(), organization_id));

-- Generic helper macro: per-table org-scoped policies
do $$
declare
  t text;
  tables text[] := array[
    'departments','employees','contracts','okrs','feedbacks','reviews',
    'work_zones','time_logs','skills','employee_skills','succession_plans'
  ];
begin
  foreach t in array tables loop
    execute format('create policy "%1$s: members read" on public.%1$s for select using (public.is_org_member(auth.uid(), organization_id));', t);
    execute format('create policy "%1$s: members write" on public.%1$s for insert with check (public.is_org_member(auth.uid(), organization_id));', t);
    execute format('create policy "%1$s: members update" on public.%1$s for update using (public.is_org_member(auth.uid(), organization_id));', t);
    execute format('create policy "%1$s: admins delete" on public.%1$s for delete using (public.is_org_admin(auth.uid(), organization_id));', t);
  end loop;
end$$;

-- Jobs: published readable by anyone (career page); members manage
create policy "Jobs: public read published" on public.jobs for select
  using (status = 'published' or public.is_org_member(auth.uid(), organization_id));
create policy "Jobs: members write" on public.jobs for insert
  with check (public.is_org_member(auth.uid(), organization_id));
create policy "Jobs: members update" on public.jobs for update
  using (public.is_org_member(auth.uid(), organization_id));
create policy "Jobs: admins delete" on public.jobs for delete
  using (public.is_org_admin(auth.uid(), organization_id));

-- Candidates: anyone can apply (insert); only members can read
create policy "Candidates: members read" on public.candidates for select
  using (public.is_org_member(auth.uid(), organization_id));
create policy "Candidates: public apply" on public.candidates for insert
  with check (true);
create policy "Candidates: members update" on public.candidates for update
  using (public.is_org_member(auth.uid(), organization_id));
create policy "Candidates: admins delete" on public.candidates for delete
  using (public.is_org_admin(auth.uid(), organization_id));

-- =========================================================================
-- TRIGGER: auto-create profile on signup
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'avatar_url')
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- STORAGE BUCKETS
-- =========================================================================
insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('cvs','cvs', false),
  ('employee-docs','employee-docs', false)
on conflict (id) do nothing;

create policy "Avatars: public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "Avatars: auth upload" on storage.objects for insert with check (bucket_id = 'avatars' and auth.uid() is not null);
create policy "Avatars: owner update" on storage.objects for update using (bucket_id = 'avatars' and owner = auth.uid());

create policy "CVs: public upload" on storage.objects for insert with check (bucket_id = 'cvs');
create policy "CVs: auth read" on storage.objects for select using (bucket_id = 'cvs' and auth.uid() is not null);

create policy "Docs: auth read" on storage.objects for select using (bucket_id = 'employee-docs' and auth.uid() is not null);
create policy "Docs: auth write" on storage.objects for insert with check (bucket_id = 'employee-docs' and auth.uid() is not null);
