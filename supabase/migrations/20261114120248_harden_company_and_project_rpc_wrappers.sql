-- Keep exposed PostgREST RPC wrappers SECURITY INVOKER; privileged work remains in private schema.
create or replace function private.submit_company_registration(
 p_legal_name text,p_npwp text,p_super_admin_email text,p_business_email text default null,p_notes text default null
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_npwp text; v_fingerprint text; v_ciphertext text; v_super_email text;
begin
 if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
 if p_legal_name is null or length(trim(p_legal_name)) not between 2 and 200 then raise exception 'Nama legal perusahaan wajib 2-200 karakter'; end if;
 v_super_email:=lower(trim(coalesce(p_super_admin_email,'')));
 if length(v_super_email)>254 or v_super_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'Email calon Company Super Admin wajib valid'; end if;
 if p_business_email is not null and (length(trim(p_business_email))>254 or trim(p_business_email) !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$') then raise exception 'Format email bisnis tidak valid'; end if;
 v_npwp:=private.normalize_npwp(p_npwp);
 v_fingerprint:=encode(extensions.hmac(convert_to(v_npwp,'UTF8'),convert_to(private.npwp_derive_key('fingerprint'),'UTF8'),'sha256'),'hex');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_fingerprint,0));
 if exists(select 1 from public.company_registration_requests where npwp_fingerprint=v_fingerprint) or exists(select 1 from public.companies where npwp_fingerprint=v_fingerprint) then raise exception 'NPWP sudah pernah digunakan untuk pendaftaran perusahaan'; end if;
 v_ciphertext:=encode(extensions.pgp_sym_encrypt(v_npwp,private.npwp_derive_key('encryption'),'cipher-algo=aes256,compress-algo=0'),'base64');
 insert into public.company_registration_requests(requested_by,legal_name,npwp_ciphertext,npwp_last4,npwp_fingerprint,super_admin_email,business_email,notes,status)
 values((select auth.uid()),trim(p_legal_name),v_ciphertext,right(v_npwp,4),v_fingerprint,v_super_email,nullif(lower(trim(p_business_email)),''),nullif(trim(p_notes),''),'PENDING')
 returning id into v_id;
 return v_id;
end $$;
revoke all on function private.submit_company_registration(text,text,text,text,text) from public,anon;
grant execute on function private.submit_company_registration(text,text,text,text,text) to authenticated;
create or replace function public.submit_company_registration(p_legal_name text,p_npwp text,p_super_admin_email text,p_business_email text default null,p_notes text default null)
returns uuid language sql security invoker set search_path='' as $$ select private.submit_company_registration(p_legal_name,p_npwp,p_super_admin_email,p_business_email,p_notes) $$;
revoke all on function public.submit_company_registration(text,text,text,text,text) from public,anon;
grant execute on function public.submit_company_registration(text,text,text,text,text) to authenticated;

create or replace function private.create_company_project(p_workspace_id uuid,p_project_code text,p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not private.is_company_super_admin(p_workspace_id) then raise exception 'Active Company Super Admin required'; end if;
 if p_project_code is null or trim(p_project_code) !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' then raise exception 'Project code must be 2-40 uppercase alphanumeric characters'; end if;
 insert into public.projects(workspace_id,project_code,name,description,created_by)
 values(p_workspace_id,trim(p_project_code),trim(p_name),nullif(trim(p_description),''),(select auth.uid())) returning id into v_id;
 insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by)
 select v_id,p_workspace_id,m.id,m.user_id,(select auth.uid()) from public.company_memberships m
 where m.workspace_id=p_workspace_id and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE' and m.is_company_super_admin;
 return v_id;
end $$;
revoke all on function private.create_company_project(uuid,text,text,text) from public,anon;
grant execute on function private.create_company_project(uuid,text,text,text) to authenticated;
create or replace function public.create_company_project(p_workspace_id uuid,p_project_code text,p_name text,p_description text default null)
returns uuid language sql security invoker set search_path='' as $$ select private.create_company_project(p_workspace_id,p_project_code,p_name,p_description) $$;
revoke all on function public.create_company_project(uuid,text,text,text) from public,anon;
grant execute on function public.create_company_project(uuid,text,text,text) to authenticated;

create or replace function private.grant_project_membership(p_project_id uuid,p_user_id uuid,p_permission_codes text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_project public.projects; v_cm public.company_memberships; v_pm uuid; v_code text;
begin
 select * into v_project from public.projects where id=p_project_id for update;
 if not found or not private.is_company_super_admin(v_project.workspace_id) then raise exception 'Active Company Super Admin required'; end if;
 select * into v_cm from public.company_memberships where workspace_id=v_project.workspace_id and user_id=p_user_id and membership_status='ACTIVE' for update;
 if not found then raise exception 'User must have an active Company Membership before project assignment'; end if;
 insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by,membership_status)
 values(p_project_id,v_project.workspace_id,v_cm.id,p_user_id,(select auth.uid()),'ACTIVE')
 on conflict(project_id,company_membership_id) do update set membership_status='ACTIVE',assigned_by=excluded.assigned_by,updated_at=now()
 returning id into v_pm;
 delete from public.project_membership_permissions where project_membership_id=v_pm;
 foreach v_code in array coalesce(p_permission_codes,array[]::text[]) loop
  if v_code !~ '^[a-z][a-z0-9_.:-]{1,99}$' then raise exception 'Invalid permission code'; end if;
  insert into public.project_membership_permissions(project_membership_id,permission_code,granted_by) values(v_pm,v_code,(select auth.uid()));
 end loop;
 return v_pm;
end $$;
revoke all on function private.grant_project_membership(uuid,uuid,text[]) from public,anon;
grant execute on function private.grant_project_membership(uuid,uuid,text[]) to authenticated;
create or replace function public.grant_project_membership(p_project_id uuid,p_user_id uuid,p_permission_codes text[])
returns uuid language sql security invoker set search_path='' as $$ select private.grant_project_membership(p_project_id,p_user_id,p_permission_codes) $$;
revoke all on function public.grant_project_membership(uuid,uuid,text[]) from public,anon;
grant execute on function public.grant_project_membership(uuid,uuid,text[]) to authenticated;