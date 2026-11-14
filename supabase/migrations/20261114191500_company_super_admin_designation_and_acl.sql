-- Require a separately designated Company Super Admin claimant.
alter table public.company_registration_requests add column if not exists super_admin_email text;
alter table public.company_registration_requests alter column super_admin_email set not null;
alter table public.company_registration_requests add constraint company_registration_super_admin_email_check
 check(length(super_admin_email)<=254 and super_admin_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

drop function if exists public.submit_company_registration(text,text,text,text);
create or replace function public.submit_company_registration(
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
revoke all on function public.submit_company_registration(text,text,text,text,text) from public,anon;
grant execute on function public.submit_company_registration(text,text,text,text,text) to authenticated;

create or replace function private.review_company_registration(p_request_id uuid,p_decision text,p_review_notes text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_req public.company_registration_requests; v_company uuid; v_workspace uuid;
begin
 if (select auth.uid()) is null or not exists(select 1 from public.platform_admins where user_id=(select auth.uid())) then raise exception 'Platform Super Admin required'; end if;
 if p_decision not in ('ACCEPTED','REJECTED') then raise exception 'Decision must be ACCEPTED or REJECTED'; end if;
 select * into v_req from public.company_registration_requests where id=p_request_id for update;
 if not found or v_req.status<>'PENDING' then raise exception 'Request not pending or not found'; end if;
 if p_decision='REJECTED' then
  update public.company_registration_requests set status='REJECTED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=nullif(trim(p_review_notes),'') where id=p_request_id;
  return null;
 end if;
 insert into public.companies(legal_name,npwp_ciphertext,npwp_last4,npwp_fingerprint,registration_status,created_by)
 values(v_req.legal_name,v_req.npwp_ciphertext,v_req.npwp_last4,v_req.npwp_fingerprint,'CLAIM_PENDING',v_req.requested_by) returning id into v_company;
 insert into public.workspaces(workspace_type,display_name,company_id,status) values('COMPANY',v_req.legal_name,v_company,'CLAIM_PENDING');
 insert into public.company_admin_seats(company_id,recipient_email,seat_status) values(v_company,v_req.super_admin_email,'UNCLAIMED');
 update public.company_registration_requests set status='ACCEPTED',reviewed_by=(select auth.uid()),reviewed_at=now(),review_notes=nullif(trim(p_review_notes),'') where id=p_request_id;
 return v_company;
end $$;

create policy company_admin_seats_platform_read on public.company_admin_seats for select to authenticated
 using(exists(select 1 from public.platform_admins p where p.user_id=(select auth.uid())));
grant select on public.company_admin_seats to authenticated;
revoke select on public.company_registration_requests from authenticated;
grant select (id,requested_by,legal_name,npwp_last4,super_admin_email,business_email,notes,status,reviewed_by,reviewed_at,review_notes,created_at)
 on public.company_registration_requests to authenticated;
revoke select on public.companies from authenticated;
grant select (id,legal_name,registration_status,created_by,verified_at,verified_by,created_at,updated_at)
 on public.companies to authenticated;