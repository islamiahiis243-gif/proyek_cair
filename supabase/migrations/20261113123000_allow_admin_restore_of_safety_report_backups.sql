drop policy if exists safety_insert_admin_restore on public.safety_reports;
create policy safety_insert_admin_restore on public.safety_reports for insert to authenticated
with check(auth.uid()=reported_by or public.current_user_role()='admin');
