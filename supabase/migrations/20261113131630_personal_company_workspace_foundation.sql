-- Additive foundation for Personal Workspace + Company Workspace.
-- Existing operational tables, ledgers, BOQ data, and RLS policies are intentionally untouched.

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  registration_status text not null default 'PENDING'
    check (registration_status in ('PENDING','VERIFIED','REJECTED','SUSPENDED','LEGACY_UNVERIFIED')),
  created_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace_type text not null check (workspace_type in ('PERSONAL','COMPANY')),
  display_name text not null,
  owner_user_id uuid references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete restrict,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_type_owner_company_check check (
    (workspace_type='PERSONAL' and owner_user_id is not null and company_id is null)
    or
    (workspace_type='COMPANY' and owner_user_id is null and company_id is not null)
  )
);

create unique index if not exists workspaces_one_personal_per_user
  on public.workspaces(owner_user_id) where workspace_type='PERSONAL';
create unique index if not exists workspaces_one_workspace_per_company
  on public.workspaces(company_id) where workspace_type='COMPANY';

alter table public.profiles
  add column if not exists personal_workspace_id uuid
  references public.workspaces(id) on delete set null;

create table if not exists public.company_memberships (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_status text not null default 'INVITED'
    check (membership_status in ('INVITED','ACTIVE','SUSPENDED','REVOKED')),
  is_company_super_admin boolean not null default false,
  activated_at timestamptz,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id,user_id)
);

create unique index if not exists one_active_company_super_admin_per_company
  on public.company_memberships(company_id)
  where membership_status='ACTIVE' and is_company_super_admin=true;
create index if not exists company_memberships_user_active_idx
  on public.company_memberships(user_id, company_id)
  where membership_status='ACTIVE';

create or replace function public.validate_company_membership_workspace()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_workspace_type text; v_company_id uuid;
begin
  select w.workspace_type, w.company_id into v_workspace_type, v_company_id
  from public.workspaces w where w.id = new.workspace_id;
  if v_workspace_type is distinct from 'COMPANY' or v_company_id is distinct from new.company_id then
    raise exception 'Membership must reference the matching Company Workspace';
  end if;
  return new;
end; $$;
revoke all on function public.validate_company_membership_workspace() from public, anon, authenticated;
drop trigger if exists validate_company_membership_workspace_trg on public.company_memberships;
create trigger validate_company_membership_workspace_trg
before insert or update of company_id, workspace_id on public.company_memberships
for each row execute function public.validate_company_membership_workspace();

create or replace function public.provision_personal_workspace_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid; v_display_name text;
begin
  v_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Personal Workspace'
  );
  insert into public.workspaces(workspace_type, display_name, owner_user_id)
  values ('PERSONAL', v_display_name || ' — Personal', new.id)
  on conflict (owner_user_id) where workspace_type='PERSONAL' do nothing
  returning id into v_workspace_id;
  if v_workspace_id is null then
    select id into v_workspace_id from public.workspaces
    where owner_user_id=new.id and workspace_type='PERSONAL';
  end if;
  update public.profiles set personal_workspace_id=v_workspace_id where id=new.id;
  return new;
end; $$;
revoke all on function public.provision_personal_workspace_for_auth_user() from public, anon, authenticated;
drop trigger if exists on_auth_user_created_personal_workspace on auth.users;
create trigger on_auth_user_created_personal_workspace after insert on auth.users
for each row execute function public.provision_personal_workspace_for_auth_user();

insert into public.workspaces(workspace_type, display_name, owner_user_id)
select 'PERSONAL',
       coalesce(nullif(p.full_name,''), nullif(split_part(coalesce(u.email,''),'@',1),''), 'Personal Workspace') || ' — Personal',
       u.id
from auth.users u left join public.profiles p on p.id=u.id
where not exists (select 1 from public.workspaces w where w.workspace_type='PERSONAL' and w.owner_user_id=u.id);

update public.profiles p set personal_workspace_id=w.id
from public.workspaces w
where w.workspace_type='PERSONAL' and w.owner_user_id=p.id
  and p.personal_workspace_id is distinct from w.id;

alter table public.companies enable row level security;
alter table public.workspaces enable row level security;
alter table public.company_memberships enable row level security;

drop policy if exists companies_read_members on public.companies;
create policy companies_read_members on public.companies for select to authenticated
using (exists (select 1 from public.company_memberships m
  where m.company_id=companies.id and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE'));

drop policy if exists workspaces_read_owner_or_member on public.workspaces;
create policy workspaces_read_owner_or_member on public.workspaces for select to authenticated
using (
  (workspace_type='PERSONAL' and owner_user_id=(select auth.uid()))
  or (workspace_type='COMPANY' and exists (select 1 from public.company_memberships m
    where m.workspace_id=workspaces.id and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE'))
);

drop policy if exists company_memberships_read_self on public.company_memberships;
create policy company_memberships_read_self on public.company_memberships for select to authenticated
using (user_id=(select auth.uid()));

grant select on public.companies, public.workspaces, public.company_memberships to authenticated;
-- No authenticated write policies: company/workspace provisioning remains server-controlled.
