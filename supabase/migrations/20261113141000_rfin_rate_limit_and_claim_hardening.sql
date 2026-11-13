-- RFIN hardening: persisted per-user throttling, safer issuance, serialized RFIN-A seat claims.
create table if not exists public.rfin_redemption_attempts (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 attempted_at timestamptz not null default now(),
 succeeded boolean not null default false
);
create index if not exists rfin_attempts_user_time_idx on public.rfin_redemption_attempts(user_id, attempted_at desc);
alter table public.rfin_redemption_attempts enable row level security;
revoke all on public.rfin_redemption_attempts from public,anon,authenticated;

create or replace function public.issue_rfin_a(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days')
returns text language plpgsql security definer set search_path='' as $$
declare v_code text; v_email text;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then raise exception 'Platform Super Admin required'; end if;
 v_email=lower(trim(coalesce(p_recipient_email,'')));
 if length(v_email)>254 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Valid recipient email required'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '30 days' then raise exception 'Expiry must be 1-30 days'; end if;
 perform 1 from public.companies where id=p_company_id and registration_status='VERIFIED' for update;
 if not found then raise exception 'Verified company required'; end if;
 if exists(select 1 from public.company_memberships where company_id=p_company_id and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Company already has an active Super Admin'; end if;
 update public.rfin_tokens set revoked_at=now() where company_id=p_company_id and token_class='RFIN_A' and redeemed_at is null and revoked_at is null;
 v_code='RFA-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at)
 values('RFIN_A',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,v_email,(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;

create or replace function public.issue_rfin_b(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days')
returns text language plpgsql security definer set search_path='' as $$
declare v_code text; v_email text;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=(select auth.uid()) and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Active Company Super Admin required'; end if;
 v_email=lower(trim(coalesce(p_recipient_email,'')));
 if length(v_email)>254 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Valid recipient email required'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '14 days' then raise exception 'Expiry must be 1-14 days'; end if;
 if not exists(select 1 from public.companies where id=p_company_id and registration_status='VERIFIED') then raise exception 'Verified company required'; end if;
 v_code='RFB-'||upper(encode(extensions.gen_random_bytes(24),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at)
 values('RFIN_B',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,v_email,(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;

create or replace function public.redeem_rfin(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_token public.rfin_tokens; v_user_email text; v_user_id uuid := (select auth.uid()); v_workspace uuid; v_membership uuid; v_attempt_count integer; v_code text := upper(trim(coalesce(p_code,'')));
begin
 if v_user_id is null then return jsonb_build_object('ok',false,'error','Authentication required'); end if;
 select lower(email) into v_user_email from auth.users where id=v_user_id;
 if v_user_email is null then return jsonb_build_object('ok',false,'error','Authenticated email unavailable'); end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text,0));
 select count(*) into v_attempt_count from public.rfin_redemption_attempts where user_id=v_user_id and attempted_at>now()-interval '15 minutes';
 if v_attempt_count>=10 then
  insert into public.rfin_redemption_attempts(user_id,succeeded) values(v_user_id,false);
  return jsonb_build_object('ok',false,'error','Too many attempts. Try again in 15 minutes.');
 end if;
 insert into public.rfin_redemption_attempts(user_id,succeeded) values(v_user_id,false);
 if length(v_code)<12 or length(v_code)>64 then return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed'); end if;
 select * into v_token from public.rfin_tokens where token_hash=encode(extensions.digest(v_code,'sha256'),'hex') for update;
 if not found or v_token.redeemed_at is not null or v_token.revoked_at is not null or v_token.expires_at<=now() then return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed'); end if;
 if lower(v_token.recipient_email)<>v_user_email then return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed'); end if;
 perform 1 from public.companies where id=v_token.company_id and registration_status='VERIFIED' for update;
 if not found then return jsonb_build_object('ok',false,'error','RFIN invalid, expired, revoked or already redeemed'); end if;
 select id into v_workspace from public.workspaces where company_id=v_token.company_id and workspace_type='COMPANY';
 if v_workspace is null then return jsonb_build_object('ok',false,'error','Company Workspace unavailable'); end if;
 if v_token.token_class='RFIN_A' then
  if exists(select 1 from public.company_memberships where company_id=v_token.company_id and membership_status='ACTIVE' and is_company_super_admin) then return jsonb_build_object('ok',false,'error','Company Super Admin seat already claimed'); end if;
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by) values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',true,now(),v_token.issued_by) returning id into v_membership;
 else
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by) values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',false,now(),v_token.issued_by)
  on conflict(company_id,user_id) do update set membership_status='ACTIVE',activated_at=now(),invited_by=excluded.invited_by returning id into v_membership;
 end if;
 update public.rfin_tokens set redeemed_at=now(),redeemed_by=v_user_id where id=v_token.id;
 update public.rfin_redemption_attempts set succeeded=true where id=(select max(id) from public.rfin_redemption_attempts where user_id=v_user_id);
 return jsonb_build_object('ok',true,'token_class',v_token.token_class,'company_id',v_token.company_id,'workspace_id',v_workspace,'membership_id',v_membership);
end $$;

revoke all on function public.issue_rfin_a(uuid,text,interval) from public,anon;
revoke all on function public.issue_rfin_b(uuid,text,interval) from public,anon;
revoke all on function public.redeem_rfin(text) from public,anon;
revoke all on function public.revoke_rfin(uuid) from public,anon;
grant execute on function public.issue_rfin_a(uuid,text,interval) to authenticated;
grant execute on function public.issue_rfin_b(uuid,text,interval) to authenticated;
grant execute on function public.redeem_rfin(text) to authenticated;
grant execute on function public.revoke_rfin(uuid) to authenticated;
