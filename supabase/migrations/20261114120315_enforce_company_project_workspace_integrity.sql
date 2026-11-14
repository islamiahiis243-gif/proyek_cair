-- Enforce tenant/workspace integrity for company memberships and project assignments.
alter table public.workspaces add constraint workspaces_id_company_id_uq unique(id,company_id);
alter table public.company_memberships add constraint company_memberships_workspace_company_fkey
 foreign key(workspace_id,company_id) references public.workspaces(id,company_id) on delete cascade;
alter table public.company_memberships add constraint company_memberships_id_workspace_id_uq unique(id,workspace_id);
alter table public.project_memberships add constraint project_memberships_company_membership_workspace_fkey
 foreign key(company_membership_id,workspace_id) references public.company_memberships(id,workspace_id) on delete cascade;

create or replace function private.create_company_project(p_workspace_id uuid,p_project_code text,p_name text,p_description text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if (select auth.uid()) is null or not private.is_company_super_admin(p_workspace_id) then raise exception 'Active Company Super Admin required'; end if;
 if not exists(select 1 from public.workspaces where id=p_workspace_id and workspace_type='COMPANY' and status='ACTIVE') then raise exception 'Active Company Workspace required'; end if;
 if p_project_code is null or trim(p_project_code) !~ '^[A-Z0-9][A-Z0-9_-]{1,39}$' then raise exception 'Project code must be 2-40 uppercase alphanumeric characters'; end if;
 insert into public.projects(workspace_id,project_code,name,description,created_by)
 values(p_workspace_id,trim(p_project_code),trim(p_name),nullif(trim(p_description),''),(select auth.uid())) returning id into v_id;
 insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by)
 select v_id,p_workspace_id,m.id,m.user_id,(select auth.uid()) from public.company_memberships m
 where m.workspace_id=p_workspace_id and m.user_id=(select auth.uid()) and m.membership_status='ACTIVE' and m.is_company_super_admin;
 return v_id;
end $$;