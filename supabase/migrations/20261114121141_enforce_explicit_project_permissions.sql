-- Project Super Admin seat is not a blanket operational permission grant.
create or replace function private.has_project_permission(p_project_id uuid,p_permission_code text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
  select 1
  from public.projects p
  join public.project_memberships pm on pm.project_id=p.id and pm.workspace_id=p.workspace_id
  join public.company_memberships cm on cm.id=pm.company_membership_id and cm.workspace_id=pm.workspace_id
  join public.project_membership_permissions pp on pp.project_membership_id=pm.id and pp.permission_code=p_permission_code
  join public.project_permission_catalog pc on pc.permission_code=pp.permission_code and pc.active
  where p.id=p_project_id and pm.user_id=(select auth.uid())
    and pm.membership_status='ACTIVE' and cm.membership_status='ACTIVE' and cm.user_id=(select auth.uid())
 )
$$;
revoke all on function private.has_project_permission(uuid,text) from public,anon,authenticated;
grant execute on function private.has_project_permission(uuid,text) to authenticated;

drop policy if exists projects_update_admin on public.projects;
create policy projects_update_scope on public.projects for update to authenticated
 using(private.is_company_super_admin(workspace_id) or private.has_project_permission(id,'project.update'))
 with check(private.is_company_super_admin(workspace_id) or private.has_project_permission(id,'project.update'));

drop policy if exists project_clients_read_scope on public.project_client_relationships;
create policy project_clients_read_scope on public.project_client_relationships for select to authenticated
 using(exists(select 1 from public.projects p where p.id=project_id and private.is_company_super_admin(p.workspace_id))
  or private.has_project_permission(project_id,'project.read'));
