-- Workspace phase 2/3: personal projects, company registration, platform admin, RFIN engine.
-- Additive only. Existing operational tables and rows are intentionally untouched.
-- pgcrypto is installed in the extensions schema on this Supabase project.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.platform_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 admin_role text not null default 'PLATFORM_SUPER_ADMIN' check(admin_role='PLATFORM_SUPER_ADMIN'),
 granted_at timestamptz not null default now(),
 granted_by uuid references auth.users(id)
);
alter table public.platform_admins enable row level security;
create policy platform_admin_self_read on public.platform_admins for select to authenticated using(user_id=(select auth.uid()));
insert into public.platform_admins(user_id) select id from auth.users where lower(email)='islamiahiis243@gmail.com' on conflict(user_id) do nothing;

create table if not exists public.personal_projects (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 2 and 160), description text,
 status text not null default 'ACTIVE' check(status in ('ACTIVE','ARCHIVED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists personal_projects_owner_idx on public.personal_projects(owner_user_id,updated_at desc);
alter table public.personal_projects enable row level security;
create policy personal_projects_owner_select on public.personal_projects for select to authenticated using(owner_user_id=(select auth.uid()) and exists(select 1 from public.workspaces w where w.id=workspace_id and w.workspace_type='PERSONAL' and w.owner_user_id=(select auth.uid())));
create policy personal_projects_owner_insert on public.personal_projects for insert to authenticated with check(owner_user_id=(select auth.uid()) and exists(select 1 from public.workspaces w where w.id=workspace_id and w.workspace_type='PERSONAL' and w.owner_user_id=(select auth.uid())));
create policy personal_projects_owner_update on public.personal_projects for update to authenticated using(owner_user_id=(select auth.uid())) with check(owner_user_id=(select auth.uid()) and exists(select 1 from public.workspaces w where w.id=workspace_id and w.workspace_type='PERSONAL' and w.owner_user_id=(select auth.uid())));
create policy personal_projects_owner_delete on public.personal_projects for delete to authenticated using(owner_user_id=(select auth.uid()));
grant select,insert,update,delete on public.personal_projects to authenticated;

create table if not exists public.company_registration_requests (
 id uuid primary key default gen_random_uuid(), requested_by uuid not null references auth.users(id),
 legal_name text not null check(length(trim(legal_name)) between 2 and 200), npwp_ciphertext text, npwp_last4 text,
 business_email text, notes text, status text not null default 'SUBMITTED' check(status in ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_notes text, created_at timestamptz not null default now()
);
alter table public.company_registration_requests enable row level security;
create policy company_registration_request_owner_read on public.company_registration_requests for select to authenticated using(requested_by=(select auth.uid()));
create policy company_registration_request_owner_insert on public.company_registration_requests for insert to authenticated with check(requested_by=(select auth.uid()) and status='SUBMITTED' and reviewed_by is null);
create policy company_registration_platform_read on public.company_registration_requests for select to authenticated using(exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid())));
grant select,insert on public.company_registration_requests to authenticated;

create table if not exists public.rfin_tokens (
 id uuid primary key default gen_random_uuid(), token_class text not null check(token_class in ('RFIN_A','RFIN_B')),
 token_hash text not null unique, company_id uuid references public.companies(id) on delete cascade,
 recipient_email text not null, recipient_user_id uuid references auth.users(id) on delete cascade,
 issued_by uuid not null references auth.users(id), expires_at timestamptz not null, redeemed_at timestamptz,
 redeemed_by uuid references auth.users(id), revoked_at timestamptz, created_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);
create index if not exists rfin_company_class_idx on public.rfin_tokens(company_id,token_class,expires_at);
alter table public.rfin_tokens enable row level security;
revoke all on public.rfin_tokens from anon,authenticated;

create table if not exists public.workspace_context_audit (
 id bigint generated always as identity primary key, user_id uuid not null references auth.users(id),
 from_workspace_id uuid references public.workspaces(id), to_workspace_id uuid not null references public.workspaces(id),
 switched_at timestamptz not null default now()
);
alter table public.workspace_context_audit enable row level security;
create policy workspace_context_audit_self_read on public.workspace_context_audit for select to authenticated using(user_id=(select auth.uid()));
create policy workspace_context_audit_self_insert on public.workspace_context_audit for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.workspaces w where w.id=to_workspace_id and (w.owner_user_id=(select auth.uid()) or exists(select 1 from public.company_memberships m where m.workspace_id=w.id and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE'))));
grant select,insert on public.workspace_context_audit to authenticated;

create function public.create_personal_project(p_name text,p_description text default null) returns public.personal_projects
language plpgsql security invoker set search_path='' as $$
declare v_workspace uuid; v_row public.personal_projects;
begin
 select personal_workspace_id into v_workspace from public.profiles where id=(select auth.uid());
 if v_workspace is null then raise exception 'Personal Workspace belum tersedia'; end if;
 insert into public.personal_projects(workspace_id,owner_user_id,name,description)
 values(v_workspace,(select auth.uid()),trim(p_name),nullif(trim(p_description),'')) returning * into v_row;
 return v_row;
end $$;
grant execute on function public.create_personal_project(text,text) to authenticated;

create function public.submit_company_registration(p_legal_name text,p_business_email text default null,p_notes text default null) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_id uuid;
begin
 insert into public.company_registration_requests(requested_by,legal_name,business_email,notes)
 values((select auth.uid()),trim(p_legal_name),nullif(trim(p_business_email),''),nullif(trim(p_notes),'')) returning id into v_id;
 return v_id;
end $$;
grant execute on function public.submit_company_registration(text,text,text) to authenticated;

create function public.review_company_registration(p_request_id uuid,p_decision text,p_review_notes text default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_req public.company_registration_requests; v_company uuid; v_workspace uuid;
begin
 if not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then raise exception 'Platform Super Admin required'; end if;
 if p_decision not in ('APPROVED','REJECTED') then raise exception 'Invalid decision'; end if;
 select * into v_req from public.company_registration_requests where id=p_request_id for update;
 if not found or v_req.status not in ('SUBMITTED','UNDER_REVIEW') then raise exception 'Request not reviewable'; end if;
 if p_decision='REJECTED' then
  update public.company_registration_requests set status='REJECTED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=p_review_notes where id=p_request_id;
  return null;
 end if;
 insert into public.companies(legal_name,registration_status,created_by,verified_at,verified_by)
 values(v_req.legal_name,'VERIFIED',v_req.requested_by,now(),(select auth.uid())) returning id into v_company;
 insert into public.workspaces(workspace_type,display_name,company_id,status) values('COMPANY',v_req.legal_name,v_company,'ACTIVE') returning id into v_workspace;
 update public.company_registration_requests set status='APPROVED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=p_review_notes where id=p_request_id;
 return v_company;
end $$;
revoke all on function public.review_company_registration(uuid,text,text) from public,anon;
grant execute on function public.review_company_registration(uuid,text,text) to authenticated;

create function public.issue_rfin_a(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days') returns text
language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then raise exception 'Platform Super Admin required'; end if;
 if not exists(select 1 from public.companies where id=p_company_id and registration_status='VERIFIED') then raise exception 'Verified company required'; end if;
 if exists(select 1 from public.company_memberships where company_id=p_company_id and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Company already has an active Super Admin'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '30 days' then raise exception 'Expiry must be 1-30 days'; end if;
 v_code='RFA-'||upper(encode(extensions.gen_random_bytes(18),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at)
 values('RFIN_A',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,lower(trim(p_recipient_email)),(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;
revoke all on function public.issue_rfin_a(uuid,text,interval) from public,anon;
grant execute on function public.issue_rfin_a(uuid,text,interval) to authenticated;

create function public.issue_rfin_b(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days') returns text
language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=(select auth.uid()) and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Active Company Super Admin required'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '14 days' then raise exception 'Expiry must be 1-14 days'; end if;
 v_code='RFB-'||upper(encode(extensions.gen_random_bytes(18),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at)
 values('RFIN_B',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,lower(trim(p_recipient_email)),(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;
revoke all on function public.issue_rfin_b(uuid,text,interval) from public,anon;
grant execute on function public.issue_rfin_b(uuid,text,interval) to authenticated;

create function public.redeem_rfin(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.rfin_tokens; v_user_email text; v_workspace uuid; v_membership uuid;
begin
 select lower(email) into v_user_email from auth.users where id=(select auth.uid());
 if v_user_email is null then raise exception 'Authentication required'; end if;
 select * into v_token from public.rfin_tokens where token_hash=encode(extensions.digest(trim(p_code),'sha256'),'hex') for update;
 if not found or v_token.redeemed_at is not null or v_token.revoked_at is not null or v_token.expires_at<=now() then raise exception 'RFIN invalid, expired, revoked or already redeemed'; end if;
 if lower(v_token.recipient_email)<>v_user_email then raise exception 'RFIN recipient mismatch'; end if;
 select id into v_workspace from public.workspaces where company_id=v_token.company_id and workspace_type='COMPANY';
 if v_workspace is null then raise exception 'Company Workspace missing'; end if;
 if v_token.token_class='RFIN_A' then
  if exists(select 1 from public.company_memberships where company_id=v_token.company_id and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Company Super Admin seat already claimed'; end if;
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
  values(v_token.company_id,v_workspace,(select auth.uid()),'ACTIVE',true,now(),v_token.issued_by) returning id into v_membership;
 else
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
  values(v_token.company_id,v_workspace,(select auth.uid()),'ACTIVE',false,now(),v_token.issued_by)
  on conflict(company_id,user_id) do update set membership_status='ACTIVE',activated_at=now(),invited_by=excluded.invited_by returning id into v_membership;
 end if;
 update public.rfin_tokens set redeemed_at=now(),redeemed_by=(select auth.uid()) where id=v_token.id;
 return jsonb_build_object('token_class',v_token.token_class,'company_id',v_token.company_id,'workspace_id',v_workspace,'membership_id',v_membership);
end $$;
revoke all on function public.redeem_rfin(text) from public,anon;
grant execute on function public.redeem_rfin(text) to authenticated;

create function public.revoke_rfin(p_token_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.rfin_tokens set revoked_at=now() where id=p_token_id and redeemed_at is null and revoked_at is null
 and (issued_by=(select auth.uid()) or exists(select 1 from public.platform_admins where user_id=(select auth.uid())));
 if not found then raise exception 'Token not found or not authorized'; end if;
end $$;
revoke all on function public.revoke_rfin(uuid) from public,anon;
grant execute on function public.revoke_rfin(uuid) to authenticated;
