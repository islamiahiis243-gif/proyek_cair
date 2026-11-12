drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated
using(public.current_user_role()='admin')
with check(public.current_user_role()='admin');
grant update on public.profiles to authenticated;
