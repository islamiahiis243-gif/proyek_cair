insert into public.project_permission_catalog
(permission_code,module,action,risk_level,requires_authority_check,active,description)
values('personnel.roster.manage','personnel','roster.manage','MEDIUM',false,true,
'Manage operational personnel roster only; this does not create or grant Auth identities, Company Memberships, project memberships, or permissions')
on conflict(permission_code) do update set
 module=excluded.module,action=excluded.action,risk_level=excluded.risk_level,
 requires_authority_check=excluded.requires_authority_check,active=true,description=excluded.description;

drop policy if exists project_personnel_project_scope_insert_guard on public.project_personnel;
create policy project_personnel_project_scope_insert_guard
on public.project_personnel as restrictive for insert to authenticated
with check(private.project_scope_guard(project_id,'personnel.roster.manage'));

drop policy if exists project_personnel_project_scope_update_guard on public.project_personnel;
create policy project_personnel_project_scope_update_guard
on public.project_personnel as restrictive for update to authenticated
using(private.project_scope_guard(project_id,'personnel.roster.manage'))
with check(private.project_scope_guard(project_id,'personnel.roster.manage'));;
