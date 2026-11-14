-- Production-safe, additive onboarding + canonical project registry correction.
-- No legacy operational rows are reassigned by this migration.
create schema if not exists private;

-- A random master key is generated inside Postgres and persisted only through Supabase Vault.
do $$
begin
  if not exists (select 1 from vault.secrets where name='proyek_cair_npwp_master_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32),'hex'),
      'proyek_cair_npwp_master_key',
      'Master key for Proyek Cair NPWP encryption and keyed duplicate fingerprints'
    );
  end if;
end $$;

create or replace function private.npwp_master_key()
returns text
language sql
stable
security definer
set search_path=''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='proyek_cair_npwp_master_key'
  limit 1
$$;

create or replace function private.npwp_derive_key(p_purpose text)
returns text
language sql
stable
security definer
set search_path=''
as $$
  select encode(
    extensions.hmac(
      convert_to(private.npwp_master_key(),'UTF8'),
      convert_to('proyek-cair/npwp/'||p_purpose,'UTF8'),
      'sha256'
    ),
    'hex'
  )
$$;

create or replace function private.normalize_npwp(p_npwp text)
returns text
language plpgsql
immutable
set search_path=''
as $$
declare v text;
begin
  if p_npwp is null or length(trim(p_npwp))=0 then
    raise exception 'NPWP wajib diisi';
  end if;
  if trim(p_npwp) !~ '^[0-9. /-]+$' then
    raise exception 'Format NPWP tidak valid';
  end if;
  v := regexp_replace(trim(p_npwp),'[^0-9]','','g');
  if length(v) not in (15,16) then
    raise exception 'NPWP harus terdiri dari 15 atau 16 digit';
  end if;
  return v;
end
$$;

revoke all on function private.npwp_master_key() from public,anon,authenticated;
revoke all on function private.npwp_derive_key(text) from public,anon,authenticated;
revoke all on function private.normalize_npwp(text) from public,anon,authenticated;

alter table public.company_registration_requests
  add column if not exists npwp_fingerprint text;
alter table public.companies
  add column if not exists npwp_ciphertext text,
  add column if not exists npwp_last4 text,
  add column if not exists npwp_fingerprint text;

create unique index if not exists company_registration_requests_npwp_fingerprint_uq
  on public.company_registration_requests(npwp_fingerprint)
  where npwp_fingerprint is not null;
create unique index if not exists companies_npwp_fingerprint_uq
  on public.companies(npwp_fingerprint)
  where npwp_fingerprint is not null;

-- The current tables are empty for these onboarding records; make NPWP mandatory for all new requests.
alter table public.company_registration_requests
  alter column npwp_ciphertext set not null,
  alter column npwp_last4 set not null,
  alter column npwp_fingerprint set not null;

do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid='public.company_registration_requests'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.company_registration_requests drop constraint %I',c.conname); end loop;
  for c in
    select conname from pg_constraint
    where conrelid='public.companies'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%registration_status%'
  loop execute format('alter table public.companies drop constraint %I',c.conname); end loop;
  for c in
    select conname from pg_constraint
    where conrelid='public.workspaces'::regclass
      and contype='c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.workspaces drop constraint %I',c.conname); end loop;
end $$;

alter table public.company_registration_requests
  alter column status set default 'PENDING',
  add constraint company_registration_requests_status_check
  check(status in ('PENDING','ACCEPTED','REJECTED'));
alter table public.companies
  add constraint companies_registration_status_check
  check(registration_status in ('PENDING','CLAIM_PENDING','ACTIVE','VERIFIED','REJECTED','SUSPENDED','LEGACY_UNVERIFIED'));
alter table public.workspaces
  add constraint workspaces_status_check
  check(status in ('CLAIM_PENDING','ACTIVE','SUSPENDED','ARCHIVED'));

create table if not exists public.company_admin_seats (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  recipient_email text not null,
  seat_status text not null default 'UNCLAIMED' check(seat_status in ('UNCLAIMED','CLAIMED','REVOKED')),
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_admin_seat_claim_state_check check (
    (seat_status='UNCLAIMED' and claimed_by is null and claimed_at is null)
    or (seat_status='CLAIMED' and claimed_by is not null and claimed_at is not null)
    or seat_status='REVOKED'
  )
);
alter table public.company_admin_seats enable row level security;
revoke all on public.company_admin_seats from public,anon,authenticated;

-- Replace the old unsafe three-argument RPC. All NPWP processing stays server-side.
drop function if exists public.submit_company_registration(text,text,text);
create or replace function public.submit_company_registration(
  p_legal_name text,
  p_npwp text,
  p_business_email text default null,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid;
  v_npwp text;
  v_fingerprint text;
  v_ciphertext text;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if p_legal_name is null or length(trim(p_legal_name)) not between 2 and 200 then
    raise exception 'Nama legal perusahaan wajib 2-200 karakter';
  end if;
  if p_business_email is not null and (length(trim(p_business_email))>254 or trim(p_business_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') then
    raise exception 'Format email bisnis tidak valid';
  end if;
  v_npwp := private.normalize_npwp(p_npwp);
  v_fingerprint := encode(extensions.hmac(convert_to(v_npwp,'UTF8'),convert_to(private.npwp_derive_key('fingerprint'),'UTF8'),'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fingerprint,0));
  if exists(select 1 from public.company_registration_requests where npwp_fingerprint=v_fingerprint)
     or exists(select 1 from public.companies where npwp_fingerprint=v_fingerprint) then
    raise exception 'NPWP sudah pernah digunakan untuk pendaftaran perusahaan';
  end if;
  v_ciphertext := encode(
    extensions.pgp_sym_encrypt(v_npwp,private.npwp_derive_key('encryption'),'cipher-algo=aes256,compress-algo=0'),
    'base64'
  );
  insert into public.company_registration_requests(
    requested_by,legal_name,npwp_ciphertext,npwp_last4,npwp_fingerprint,business_email,notes,status
  ) values (
    (select auth.uid()),trim(p_legal_name),v_ciphertext,right(v_npwp,4),v_fingerprint,
    nullif(lower(trim(p_business_email)),''),nullif(trim(p_notes),''),'PENDING'
  ) returning id into v_id;
  return v_id;
end
$$;
revoke all on function public.submit_company_registration(text,text,text,text) from public,anon;
grant execute on function public.submit_company_registration(text,text,text,text) to authenticated;

-- Application acceptance provisions a dormant tenant and one unclaimed Company Super Admin seat.
create or replace function private.review_company_registration(
  p_request_id uuid,p_decision text,p_review_notes text default null
) returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_req public.company_registration_requests; v_company uuid; v_workspace uuid;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then
    raise exception 'Platform Super Admin required';
  end if;
  if p_decision not in ('ACCEPTED','REJECTED') then raise exception 'Decision must be ACCEPTED or REJECTED'; end if;
  select * into v_req from public.company_registration_requests where id=p_request_id for update;
  if not found or v_req.status<>'PENDING' then raise exception 'Request not pending or not found'; end if;

  if p_decision='REJECTED' then
    update public.company_registration_requests
      set status='REJECTED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=nullif(trim(p_review_notes),'')
      where id=p_request_id;
    return null;
  end if;

  insert into public.companies(legal_name,npwp_ciphertext,npwp_last4,npwp_fingerprint,registration_status,created_by)
  values(v_req.legal_name,v_req.npwp_ciphertext,v_req.npwp_last4,v_req.npwp_fingerprint,'CLAIM_PENDING',v_req.requested_by)
  returning id into v_company;

  insert into public.workspaces(workspace_type,display_name,company_id,status)
  values('COMPANY',v_req.legal_name,v_company,'CLAIM_PENDING')
  returning id into v_workspace;

  insert into public.company_admin_seats(company_id,recipient_email,seat_status)
  values(v_company,coalesce(lower(v_req.business_email),(select lower(email) from auth.users where id=v_req.requested_by)),'UNCLAIMED');

  update public.company_registration_requests
    set status='ACCEPTED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=nullif(trim(p_review_notes),'')
    where id=p_request_id;
  return v_company;
end
$$;

create or replace function public.review_company_registration(
  p_request_id uuid,p_decision text,p_review_notes text default null
) returns uuid
language sql
set search_path=''
as $$ select private.review_company_registration(p_request_id,p_decision,p_review_notes) $$;
revoke all on function private.review_company_registration(uuid,text,text) from public,anon,authenticated;
revoke all on function public.review_company_registration(uuid,text,text) from public,anon;
grant execute on function public.review_company_registration(uuid,text,text) to authenticated;

-- RFIN-A is only issuable for the designated, unclaimed seat after acceptance.
create or replace function private.issue_rfin_a(
  p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days'
) returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_code text; v_email text; v_seat public.company_admin_seats;
begin
  if (select auth.uid()) is null or not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then
    raise exception 'Platform Super Admin required';
  end if;
  v_email:=lower(trim(coalesce(p_recipient_email,'')));
  if length(v_email)>254 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Valid recipient email required'; end if;
  if p_expires_in<=interval '0' or p_expires_in>interval '30 days' then raise exception 'Expiry must be 1-30 days'; end if;
  perform 1 from public.companies where id=p_company_id and registration_status='CLAIM_PENDING' for update;
  if not found then raise exception 'Company must be CLAIM_PENDING'; end if;
  select * into v_seat from public.company_admin_seats where company_id=p_company_id for update;
  if not found or v_seat.seat_status<>'UNCLAIMED' then raise exception 'Company Super Admin seat is not unclaimed'; end if;
  if lower(v_seat.recipient_email)<>v_email then raise exception 'Recipient must match the designated Company Super Admin seat'; end if;
  if exists(select 1 from public.company_memberships where company_id=p_company_id and membership_status='ACTIVE' and is_company_super_admin) then
    raise exception 'Company already has an active Super Admin';
  end if;
  update public.rfin_tokens set revoked_at=now()
    where company_id=p_company_id and token_class='RFIN_A' and redeemed_at is null and revoked_at is null;
  v_code:='RFA-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
  insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at)
  values('RFIN_A',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,v_email,(select auth.uid()),now()+p_expires_in);
  return v_code;
end
$$;
revoke all on function private.issue_rfin_a(uuid,text,interval) from public,anon,authenticated;
grant execute on function private.issue_rfin_a(uuid,text,interval) to authenticated;

-- RFIN-A redemption atomically activates tenant + workspace + reserved seat.
create or replace function private.redeem_rfin(p_code text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_token public.rfin_tokens;
  v_user_email text;
  v_user_id uuid := (select auth.uid());
  v_workspace uuid;
  v_membership uuid;
  v_attempt_count integer;
  v_code text := upper(trim(coalesce(p_code,'')));
  v_seat public.company_admin_seats;
begin
  if v_user_id is null then return jsonb_build_object('ok',false,'error','Authentication required'); end if;
  select lower(email) into v_user_email from auth.users where id=v_user_id;
  if v_user_email is null then return jsonb_build_object('ok',false,'error','Authenticated email unavailable'); end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text,0));
  select count(*) into v_attempt_count from public.rfin_redemption_attempts
    where user_id=v_user_id and attempted_at>now()-interval '15 minutes';
  if v_attempt_count>=10 then
    insert into public.rfin_redemption_attempts(user_id,succeeded) values(v_user_id,false);
    return jsonb_build_object('ok',false,'error','Too many attempts. Try again in 15 minutes.');
  end if;
  insert into public.rfin_redemption_attempts(user_id,succeeded) values(v_user_id,false);
  if length(v_code)<12 or length(v_code)>64 then
    return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed');
  end if;
  select * into v_token from public.rfin_tokens
    where token_hash=encode(extensions.digest(v_code,'sha256'),'hex') for update;
  if not found or v_token.redeemed_at is not null or v_token.revoked_at is not null or v_token.expires_at<=now() then
    return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed');
  end if;
  if lower(v_token.recipient_email)<>v_user_email then
    return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed');
  end if;
  if v_token.token_class='RFIN_A' then
    perform 1 from public.companies where id=v_token.company_id and registration_status='CLAIM_PENDING' for update;
    if not found then return jsonb_build_object('ok',false,'error','Company claim is not available'); end if;
    select * into v_seat from public.company_admin_seats where company_id=v_token.company_id for update;
    if not found or v_seat.seat_status<>'UNCLAIMED' or lower(v_seat.recipient_email)<>v_user_email then
      return jsonb_build_object('ok',false,'error','Company Super Admin seat unavailable');
    end if;
  else
    perform 1 from public.companies where id=v_token.company_id and registration_status in ('ACTIVE','VERIFIED') for update;
    if not found then return jsonb_build_object('ok',false,'error','Company is not active'); end if;
  end if;
  select id into v_workspace from public.workspaces where company_id=v_token.company_id and workspace_type='COMPANY';
  if v_workspace is null then return jsonb_build_object('ok',false,'error','Company Workspace unavailable'); end if;

  if v_token.token_class='RFIN_A' then
    if exists(select 1 from public.company_memberships where company_id=v_token.company_id and membership_status='ACTIVE' and is_company_super_admin) then
      return jsonb_build_object('ok',false,'error','Company Super Admin seat already claimed');
    end if;
    insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
    values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',true,now(),v_token.issued_by)
    returning id into v_membership;
    update public.company_admin_seats set seat_status='CLAIMED',claimed_by=v_user_id,claimed_at=now(),updated_at=now()
      where company_id=v_token.company_id and seat_status='UNCLAIMED';
    update public.companies set registration_status='ACTIVE',verified_at=now(),verified_by=v_token.issued_by,updated_at=now()
      where id=v_token.company_id;
    update public.workspaces set status='ACTIVE',updated_at=now() where id=v_workspace;
  else
    insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
    values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',false,now(),v_token.issued_by)
    on conflict(company_id,user_id) do update
      set membership_status='ACTIVE',activated_at=now(),invited_by=excluded.invited_by
    returning id into v_membership;
  end if;
  update public.rfin_tokens set redeemed_at=now(),redeemed_by=v_user_id where id=v_token.id;
  update public.rfin_redemption_attempts set succeeded=true
    where id=(select max(id) from public.rfin_redemption_attempts where user_id=v_user_id);
  return jsonb_build_object('ok',true,'token_class',v_token.token_class,'company_id',v_token.company_id,'workspace_id',v_workspace,'membership_id',v_membership);
end
$$;
revoke all on function private.redeem_rfin(text) from public,anon,authenticated;
grant execute on function private.redeem_rfin(text) to authenticated;

-- One active Company Super Admin at most per tenant.
create unique index if not exists company_memberships_one_active_super_admin_uq
  on public.company_memberships(company_id)
  where is_company_super_admin and membership_status='ACTIVE';

-- Canonical Project Registry. Client relationship rows intentionally have no company/workspace FK.
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_code text not null,
  name text not null check(length(trim(name)) between 2 and 200),
  description text,
  status text not null default 'ACTIVE' check(status in ('ACTIVE','ON_HOLD','COMPLETED','ARCHIVED')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id,project_code),
  unique(id,workspace_id)
);
create table if not exists public.project_client_relationships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  client_name text not null,
  relationship_type text not null default 'CLIENT' check(relationship_type in ('CLIENT','OWNER','CONSULTANT','OTHER')),
  commercial_reference text,
  notes text,
  created_at timestamptz not null default now(),
  unique(project_id,client_name,relationship_type)
);
create table if not exists public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  company_membership_id uuid not null references public.company_memberships(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  membership_status text not null default 'ACTIVE' check(membership_status in ('ACTIVE','SUSPENDED','REVOKED')),
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id,company_membership_id),
  foreign key(project_id,workspace_id) references public.projects(id,workspace_id) on delete cascade
);
create table if not exists public.project_membership_permissions (
  project_membership_id uuid not null references public.project_memberships(id) on delete cascade,
  permission_code text not null,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key(project_membership_id,permission_code)
);

create or replace function private.is_company_super_admin(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1 from public.company_memberships m
    where m.workspace_id=p_workspace_id and m.user_id=(select auth.uid())
      and m.membership_status='ACTIVE' and m.is_company_super_admin
  )
$$;

create or replace function private.has_project_permission(p_project_id uuid,p_permission_code text)
returns boolean language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.projects p
    join public.project_memberships pm on pm.project_id=p.id and pm.workspace_id=p.workspace_id
    join public.company_memberships cm on cm.id=pm.company_membership_id
    where p.id=p_project_id and pm.user_id=(select auth.uid())
      and pm.membership_status='ACTIVE' and cm.membership_status='ACTIVE'
      and cm.user_id=(select auth.uid())
      and (cm.is_company_super_admin or exists(
        select 1 from public.project_membership_permissions pp
        where pp.project_membership_id=pm.id and pp.permission_code=p_permission_code
      ))
  )
$$;
revoke all on function private.is_company_super_admin(uuid) from public,anon,authenticated;
revoke all on function private.has_project_permission(uuid,text) from public,anon,authenticated;
grant execute on function private.is_company_super_admin(uuid) to authenticated;
grant execute on function private.has_project_permission(uuid,text) to authenticated;

alter table public.projects enable row level security;
alter table public.project_client_relationships enable row level security;
alter table public.project_memberships enable row level security;
alter table public.project_membership_permissions enable row level security;

create policy projects_read_scope on public.projects for select to authenticated
  using(private.is_company_super_admin(workspace_id) or private.has_project_permission(id,'project.read'));
create policy projects_update_admin on public.projects for update to authenticated
  using(private.is_company_super_admin(workspace_id)) with check(private.is_company_super_admin(workspace_id));
create policy project_clients_read_scope on public.project_client_relationships for select to authenticated
  using(private.has_project_permission(project_id,'project.read'));
create policy project_clients_admin_manage on public.project_client_relationships for all to authenticated
  using(exists(select 1 from public.projects p where p.id=project_id and private.is_company_super_admin(p.workspace_id)))
  with check(exists(select 1 from public.projects p where p.id=project_id and private.is_company_super_admin(p.workspace_id)));
create policy project_memberships_read_scope on public.project_memberships for select to authenticated
  using(user_id=(select auth.uid()) or private.is_company_super_admin(workspace_id));
create policy project_membership_permissions_read_scope on public.project_membership_permissions for select to authenticated
  using(exists(select 1 from public.project_memberships pm where pm.id=project_membership_id and
    (pm.user_id=(select auth.uid()) or private.is_company_super_admin(pm.workspace_id))));

grant select,update on public.projects to authenticated;
grant select on public.project_client_relationships,public.project_memberships,public.project_membership_permissions to authenticated;

create or replace function public.create_company_project(
  p_workspace_id uuid,p_project_code text,p_name text,p_description text default null
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_id uuid;
begin
  if (select auth.uid()) is null or not private.is_company_super_admin(p_workspace_id) then
    raise exception 'Active Company Super Admin required';
  end if;
  if p_project_code is null or trim(p_project_code) !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' then
    raise exception 'Project code must be 2-40 uppercase alphanumeric characters';
  end if;
  insert into public.projects(workspace_id,project_code,name,description,created_by)
  values(p_workspace_id,trim(p_project_code),trim(p_name),nullif(trim(p_description),''),(select auth.uid()))
  returning id into v_id;
  insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by)
  select v_id,p_workspace_id,m.id,m.user_id,(select auth.uid())
  from public.company_memberships m
  where m.workspace_id=p_workspace_id and m.user_id=(select auth.uid())
    and m.membership_status='ACTIVE' and m.is_company_super_admin;
  return v_id;
end
$$;
revoke all on function public.create_company_project(uuid,text,text,text) from public,anon;
grant execute on function public.create_company_project(uuid,text,text,text) to authenticated;

create or replace function public.grant_project_membership(
  p_project_id uuid,p_user_id uuid,p_permission_codes text[]
) returns uuid
language plpgsql security definer set search_path=''
as $$
declare v_project public.projects; v_company_membership public.company_memberships; v_pm uuid; v_code text;
begin
  select * into v_project from public.projects where id=p_project_id for update;
  if not found or not private.is_company_super_admin(v_project.workspace_id) then
    raise exception 'Active Company Super Admin required';
  end if;
  select * into v_company_membership from public.company_memberships
    where workspace_id=v_project.workspace_id and user_id=p_user_id and membership_status='ACTIVE' for update;
  if not found then raise exception 'User must have an active Company Membership before project assignment'; end if;
  insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by,membership_status)
  values(p_project_id,v_project.workspace_id,v_company_membership.id,p_user_id,(select auth.uid()),'ACTIVE')
  on conflict(project_id,company_membership_id) do update set membership_status='ACTIVE',assigned_by=excluded.assigned_by,updated_at=now()
  returning id into v_pm;
  delete from public.project_membership_permissions where project_membership_id=v_pm;
  foreach v_code in array coalesce(p_permission_codes,array[]::text[]) loop
    if v_code !~ '^[a-z][a-z0-9_.:-]{1,99}$' then raise exception 'Invalid permission code'; end if;
    insert into public.project_membership_permissions(project_membership_id,permission_code,granted_by)
    values(v_pm,v_code,(select auth.uid()));
  end loop;
  return v_pm;
end
$$;
revoke all on function public.grant_project_membership(uuid,uuid,text[]) from public,anon;
grant execute on function public.grant_project_membership(uuid,uuid,text[]) to authenticated;

-- Nullable, paired scope keys only. Existing rows remain untouched until approved backfill.
do $$
declare t text;
begin
  foreach t in array array[
    'project_control','boq_sections','boq_items','boq_additions','item_schedules',
    'inventory_locations','inventory_transactions','inventory_transaction_reversals',
    'cash_transactions','progress_logs','safety_reports','project_media','documents',
    'document_signatures','transaction_attachments','project_personnel'
  ] loop
    execute format('alter table public.%I add column if not exists workspace_id uuid references public.workspaces(id)',t);
    execute format('alter table public.%I add column if not exists project_id uuid',t);
    execute format('alter table public.%I add constraint %I foreign key(project_id,workspace_id) references public.projects(id,workspace_id)',t,t||'_project_workspace_fkey');
    execute format('alter table public.%I add constraint %I check ((project_id is null) = (workspace_id is null))',t,t||'_project_scope_pair_check');
    execute format('create index if not exists %I on public.%I(project_id,workspace_id)',t||'_project_scope_idx',t);
  end loop;
end $$;
