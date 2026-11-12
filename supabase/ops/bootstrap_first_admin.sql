-- Run once after the first real user signs in to Supabase Auth.
-- Replace the UUID below with the intended project owner's auth.users.id.
-- Never use a demo account or commit a real user's UUID here.
update public.profiles
set role='admin', is_active=true, updated_at=now()
where id='REPLACE_WITH_AUTH_USER_UUID'
  and exists(select 1 from auth.users where id='REPLACE_WITH_AUTH_USER_UUID');
