-- Ensure personal workspace provisioning also creates/links profiles independent of trigger order.
create or replace function public.provision_personal_workspace_for_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_workspace_id uuid; v_display_name text;
begin
  v_display_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(new.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Personal Workspace'
  );
  insert into public.workspaces(workspace_type, display_name, owner_user_id)
  values ('PERSONAL', v_display_name || ' — Personal', new.id)
  on conflict (owner_user_id) where workspace_type='PERSONAL' do nothing
  returning id into v_workspace_id;
  if v_workspace_id is null then
    select id into v_workspace_id from public.workspaces
    where owner_user_id=new.id and workspace_type='PERSONAL';
  end if;
  insert into public.profiles(id,full_name,role,is_active,personal_workspace_id)
  values (new.id,v_display_name,'viewer',true,v_workspace_id)
  on conflict (id) do update set personal_workspace_id=excluded.personal_workspace_id;
  return new;
end; $$;
revoke all on function public.provision_personal_workspace_for_auth_user() from public, anon, authenticated;
