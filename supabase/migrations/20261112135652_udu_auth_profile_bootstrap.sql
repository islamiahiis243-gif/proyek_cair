-- Bootstrap least-privilege profile records for new Supabase Auth users.
create or replace function public.handle_new_udu_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.profiles(id,full_name,role,is_active)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.raw_user_meta_data->>'name',''),'viewer',true)
 on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function public.handle_new_udu_user() from public,anon,authenticated;
drop trigger if exists on_auth_user_created_udu on auth.users;
create trigger on_auth_user_created_udu after insert on auth.users for each row execute function public.handle_new_udu_user();
grant select on public.profiles to authenticated;
