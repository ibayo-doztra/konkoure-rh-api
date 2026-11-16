
create type public.social_provider as enum ('facebook', 'linkedin', 'twitter');
create type public.social_account_status as enum ('active', 'expired', 'revoked');
create type public.social_post_status as enum ('pending', 'published', 'failed');

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  provider social_provider not null,
  account_id text not null,
  account_name text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status social_account_status not null default 'active',
  connected_by uuid,
  connected_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  unique (organization_id, provider, account_id)
);

alter table public.social_accounts enable row level security;

create policy "social_accounts: members read"
  on public.social_accounts for select
  using (is_org_member(auth.uid(), organization_id));

create policy "social_accounts: members write"
  on public.social_accounts for insert
  with check (is_org_member(auth.uid(), organization_id));

create policy "social_accounts: members update"
  on public.social_accounts for update
  using (is_org_member(auth.uid(), organization_id));

create policy "social_accounts: admins delete"
  on public.social_accounts for delete
  using (is_org_admin(auth.uid(), organization_id));

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  job_id uuid not null,
  social_account_id uuid not null references public.social_accounts(id) on delete cascade,
  provider social_provider not null,
  external_post_id text,
  external_url text,
  content text not null,
  status social_post_status not null default 'pending',
  error_message text,
  published_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.social_posts enable row level security;

create policy "social_posts: members read"
  on public.social_posts for select
  using (is_org_member(auth.uid(), organization_id));

create policy "social_posts: members write"
  on public.social_posts for insert
  with check (is_org_member(auth.uid(), organization_id));

create policy "social_posts: members update"
  on public.social_posts for update
  using (is_org_member(auth.uid(), organization_id));

create policy "social_posts: admins delete"
  on public.social_posts for delete
  using (is_org_admin(auth.uid(), organization_id));

create index social_posts_job_idx on public.social_posts(job_id);
create index social_posts_org_idx on public.social_posts(organization_id);
create index social_accounts_org_idx on public.social_accounts(organization_id);
