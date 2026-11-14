-- Correct lifecycle semantics and ensure the guarded Platform review RPC can invoke its private implementation.
grant execute on function private.review_company_registration(uuid,text,text) to authenticated;

-- Platform acceptance is an application decision, not a legal/KYC verification.
create or replace function private.redeem_rfin(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_token public.rfin_tokens;
 v_user_email text;
 v_user_id uuid:=(select auth.uid());
 v_workspace uuid;
 v_membership uuid;
 v_attempt_count integer;
 v_code text:=upper(trim(coalesce(p_code,'')));
 v_seat public.company_admin_seats;
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
 if v_token.token_class='RFIN_A' then
  perform 1 from public.companies where id=v_token.company_id and registration_status='CLAIM_PENDING' for update;
  if not found then return jsonb_build_object('ok',false,'error','Company claim is not available'); end if;
  select * into v_seat from public.company_admin_seats where company_id=v_token.company_id for update;
  if not found or v_seat.seat_status<>'UNCLAIMED' or lower(v_seat.recipient_email)<>v_user_email then return jsonb_build_object('ok',false,'error','Company Super Admin seat unavailable'); end if;
 else
  perform 1 from public.companies where id=v_token.company_id and registration_status in ('ACTIVE','VERIFIED') for update;
  if not found then return jsonb_build_object('ok',false,'error','Company is not active'); end if;
 end if;
 select id into v_workspace from public.workspaces where company_id=v_token.company_id and workspace_type='COMPANY';
 if v_workspace is null then return jsonb_build_object('ok',false,'error','Company Workspace unavailable'); end if;
 if v_token.token_class='RFIN_A' then
  if exists(select 1 from public.company_memberships where company_id=v_token.company_id and membership_status='ACTIVE' and is_company_super_admin) then return jsonb_build_object('ok',false,'error','Company Super Admin seat already claimed'); end if;
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
  values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',true,now(),v_token.issued_by) returning id into v_membership;
  update public.company_admin_seats set seat_status='CLAIMED',claimed_by=v_user_id,claimed_at=now(),updated_at=now()
   where company_id=v_token.company_id and seat_status='UNCLAIMED';
  update public.companies set registration_status='ACTIVE',updated_at=now() where id=v_token.company_id;
  update public.workspaces set status='ACTIVE',updated_at=now() where id=v_workspace;
 else
  insert into public.company_memberships(company_id,workspace_id,user_id,membership_status,is_company_super_admin,activated_at,invited_by)
  values(v_token.company_id,v_workspace,v_user_id,'ACTIVE',false,now(),v_token.issued_by)
  on conflict(company_id,user_id) do update set membership_status='ACTIVE',activated_at=now(),invited_by=excluded.invited_by returning id into v_membership;
 end if;
 update public.rfin_tokens set redeemed_at=now(),redeemed_by=v_user_id where id=v_token.id;
 update public.rfin_redemption_attempts set succeeded=true where id=(select max(id) from public.rfin_redemption_attempts where user_id=v_user_id);
 return jsonb_build_object('ok',true,'token_class',v_token.token_class,'company_id',v_token.company_id,'workspace_id',v_workspace,'membership_id',v_membership);
end $$;
revoke all on function private.redeem_rfin(text) from public,anon,authenticated;
grant execute on function private.redeem_rfin(text) to authenticated;