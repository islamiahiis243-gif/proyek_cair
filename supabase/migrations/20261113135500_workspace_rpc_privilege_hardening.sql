-- Least-privilege hardening: no anonymous/public invocation of user RPCs.
revoke all on function public.create_personal_project(text,text) from public,anon;
revoke all on function public.submit_company_registration(text,text,text) from public,anon;
-- RFIN material is only accessible inside narrowly guarded SECURITY DEFINER RPCs.
drop policy if exists rfin_tokens_deny_direct_access on public.rfin_tokens;
create policy rfin_tokens_deny_direct_access on public.rfin_tokens for all to authenticated using(false) with check(false);
