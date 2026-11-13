-- Follow-up hardening for workspace admin visibility and crypto schema qualification.
drop policy if exists company_registration_platform_read on public.company_registration_requests;
create policy company_registration_platform_read on public.company_registration_requests for select to authenticated using(exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid())));
drop policy if exists companies_platform_admin_read on public.companies;
create policy companies_platform_admin_read on public.companies for select to authenticated using(exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid())));
drop policy if exists workspaces_platform_admin_read on public.workspaces;
create policy workspaces_platform_admin_read on public.workspaces for select to authenticated using(exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid())));
grant select on public.companies,public.workspaces,public.company_registration_requests to authenticated;

create or replace function public.issue_rfin_a(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days') returns text language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then raise exception 'Platform Super Admin required'; end if;
 if not exists(select 1 from public.companies where id=p_company_id and registration_status='VERIFIED') then raise exception 'Verified company required'; end if;
 if exists(select 1 from public.company_memberships where company_id=p_company_id and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Company already has an active Super Admin'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '30 days' then raise exception 'Expiry must be 1-30 days'; end if;
 v_code='RFA-'||upper(encode(extensions.gen_random_bytes(18),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at) values('RFIN_A',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,lower(trim(p_recipient_email)),(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;

create or replace function public.issue_rfin_b(p_company_id uuid,p_recipient_email text,p_expires_in interval default interval '7 days') returns text language plpgsql security definer set search_path='' as $$
declare v_code text;
begin
 if not exists(select 1 from public.company_memberships where company_id=p_company_id and user_id=(select auth.uid()) and membership_status='ACTIVE' and is_company_super_admin) then raise exception 'Active Company Super Admin required'; end if;
 if p_expires_in<=interval '0' or p_expires_in>interval '14 days' then raise exception 'Expiry must be 1-14 days'; end if;
 v_code='RFB-'||upper(encode(extensions.gen_random_bytes(18),'hex'));
 insert into public.rfin_tokens(token_class,token_hash,company_id,recipient_email,issued_by,expires_at) values('RFIN_B',encode(extensions.digest(v_code,'sha256'),'hex'),p_company_id,lower(trim(p_recipient_email)),(select auth.uid()),now()+p_expires_in);
 return v_code;
end $$;

create or replace function public.redeem_rfin(p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
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
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by) values(v_token.company_id,v_workspace,(select auth.uid()),'ACTIVE',true,now(),v_token.issued_by) returning id into v_membership;
 else
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by) values(v_token.company_id,v_workspace,(select auth.uid()),'ACTIVE',false,now(),v_token.issued_by)
  on conflict(company_id,user_id) do update set membership_status='ACTIVE',activated_at=now(),invited_by=excluded.invited_by returning id into v_membership;
 end if;
 update public.rfin_tokens set redeemed_at=now(),redeemed_by=(select auth.uid()) where id=v_token.id;
 return jsonb_build_object('token_class',v_token.token_class,'company_id',v_token.company_id,'workspace_id',v_workspace,'membership_id',v_membership);
end $$;
