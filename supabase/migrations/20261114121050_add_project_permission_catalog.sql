-- Canonical project-scoped permission catalog based on USERS_SSOT.md §18.2.
create table if not exists public.project_permission_catalog (
 permission_code text primary key,
 module text not null,
 action text not null,
 risk_level text not null check(risk_level in ('LOW','MEDIUM','HIGH','CRITICAL')),
 requires_authority_check boolean not null default false,
 active boolean not null default true,
 description text not null
);
alter table public.project_permission_catalog enable row level security;
create policy project_permission_catalog_read on public.project_permission_catalog for select to authenticated using(active);
grant select on public.project_permission_catalog to authenticated;

insert into public.project_permission_catalog(permission_code,module,action,risk_level,requires_authority_check,description) values
('project.read','project','read','LOW',false,'Read project master and project-scoped resources'),
('project.create','project','create','MEDIUM',false,'Create a project under an active Company Workspace; actual creation remains Company Super Admin only'),
('project.update','project','update','MEDIUM',false,'Update project metadata'),
('project.assign','project','assign','HIGH',false,'Assign active Company Members to the project and configure project scope'),
('project.close','project','close','HIGH',true,'Close project under approved project lifecycle policy'),
('boq.read','boq','read','LOW',false,'Read BOQ items and hierarchy'),
('boq.create','boq','create','MEDIUM',false,'Create BOQ items'),
('boq.update','boq','update','MEDIUM',false,'Update eligible BOQ drafts'),
('boq.submit','boq','submit','HIGH',false,'Submit BOQ changes for review'),
('boq.review','boq','review','HIGH',true,'Review BOQ changes'),
('boq.approve','boq','approve','CRITICAL',true,'Approve BOQ changes within delegated authority'),
('boq.addition.create','boq','addition.create','MEDIUM',false,'Create an additional BOQ item request'),
('boq.revision','boq','revision','HIGH',true,'Initiate or manage a BOQ revision'),
('progress.read','progress','read','LOW',false,'Read project progress'),
('progress.create','progress','create','MEDIUM',false,'Create progress records'),
('progress.update','progress','update','MEDIUM',false,'Update eligible progress drafts'),
('progress.submit','progress','submit','HIGH',false,'Submit progress for review'),
('progress.review','progress','review','HIGH',true,'Review progress submissions'),
('progress.verify','progress','verify','HIGH',true,'Verify measured progress'),
('progress.approve','progress','approve','CRITICAL',true,'Approve progress within delegated authority'),
('progress.return','progress','return','HIGH',true,'Return progress submission with reason'),
('procurement.read','procurement','read','LOW',false,'Read procurement records'),
('procurement.create','procurement','create','MEDIUM',false,'Create procurement request'),
('procurement.update','procurement','update','MEDIUM',false,'Update eligible procurement draft'),
('procurement.submit','procurement','submit','HIGH',false,'Submit procurement request'),
('procurement.review','procurement','review','HIGH',true,'Review procurement request'),
('procurement.approve','procurement','approve','CRITICAL',true,'Approve procurement within delegated authority'),
('procurement.issue_order','procurement','issue_order','CRITICAL',true,'Issue procurement order under authority policy'),
('procurement.receive','procurement','receive','HIGH',true,'Record procurement receipt'),
('inventory.read','inventory','read','LOW',false,'Read project inventory'),
('inventory.movement.create','inventory','movement.create','MEDIUM',false,'Create inventory movement request'),
('inventory.movement.review','inventory','movement.review','HIGH',true,'Review inventory movement'),
('inventory.movement.approve','inventory','movement.approve','CRITICAL',true,'Approve inventory movement'),
('inventory.movement.reverse','inventory','movement.reverse','CRITICAL',true,'Reverse inventory movement through audited workflow'),
('inventory.count','inventory','count','HIGH',true,'Perform or attest inventory count'),
('cash.read','cash','read','LOW',false,'Read project cash and finance records'),
('cash.transaction.create','cash','transaction.create','MEDIUM',false,'Create cash transaction draft'),
('cash.transaction.submit','cash','transaction.submit','HIGH',false,'Submit cash transaction'),
('cash.transaction.review','cash','transaction.review','HIGH',true,'Review cash transaction'),
('cash.transaction.approve','cash','transaction.approve','CRITICAL',true,'Approve cash transaction within delegated authority'),
('cash.transaction.void','cash','transaction.void','CRITICAL',true,'Void cash transaction under controlled workflow'),
('cash.transaction.reverse','cash','transaction.reverse','CRITICAL',true,'Reverse cash transaction through an audited event'),
('cash.export','cash','export','HIGH',true,'Export project financial data'),
('k3.read','k3','read','LOW',false,'Read project K3/HSE records'),
('k3.report.create','k3','report.create','MEDIUM',false,'Create K3 report'),
('k3.report.update','k3','report.update','MEDIUM',false,'Update eligible K3 report draft'),
('k3.report.submit','k3','report.submit','HIGH',false,'Submit K3 report'),
('k3.report.review','k3','report.review','HIGH',true,'Review K3 report'),
('k3.report.close','k3','report.close','HIGH',true,'Close K3 report'),
('k3.incident.manage','k3','incident.manage','CRITICAL',true,'Manage K3 incident response'),
('document.read','document','read','LOW',false,'Read project documents subject to document-level ACL'),
('document.create','document','create','MEDIUM',false,'Create document draft'),
('document.update','document','update','MEDIUM',false,'Update eligible document draft'),
('document.submit','document','submit','HIGH',false,'Submit document for workflow'),
('document.review','document','review','HIGH',true,'Review document'),
('document.approve','document','approve','CRITICAL',true,'Approve document within delegated authority'),
('document.issue','document','issue','CRITICAL',true,'Issue final document under authority policy'),
('document.sign','document','sign','CRITICAL',true,'Request signing; final signatory appointment and backend authority checks remain mandatory'),
('document.void','document','void','CRITICAL',true,'Void issued document under controlled workflow'),
('document.replace','document','replace','HIGH',true,'Supersede or replace document'),
('document.qr.scan','document','qr.scan','HIGH',true,'Scan a private document QR code under document ACL'),
('document.qr.verify','document','qr.verify','HIGH',true,'Verify a private document QR code under document ACL'),
('workflow.read','workflow','read','LOW',false,'Read workflow status and history within project scope'),
('workflow.start','workflow','start','HIGH',false,'Start an eligible project workflow'),
('workflow.cancel','workflow','cancel','HIGH',true,'Cancel workflow under policy'),
('workflow.step.act','workflow','step.act','CRITICAL',true,'Act on the currently assigned workflow step'),
('workflow.delegate','workflow','delegate','HIGH',true,'Delegate active workflow step under delegation policy'),
('workflow.reassign','workflow','reassign','HIGH',true,'Reassign workflow step under reassignment policy'),
('audit.read','audit','read','HIGH',true,'Read project audit trail'),
('audit.export','audit','export','CRITICAL',true,'Export project audit trail'),
('notification.read','notification','read','LOW',false,'Read project notifications'),
('notification.preference.update','notification','preference.update','LOW',false,'Update own notification preferences'),
('notification.manage','notification','manage','HIGH',true,'Manage project notification delivery within policy')
on conflict(permission_code) do update set
 module=excluded.module,action=excluded.action,risk_level=excluded.risk_level,
 requires_authority_check=excluded.requires_authority_check,description=excluded.description,active=true;

alter table public.project_membership_permissions
 add constraint project_membership_permissions_catalog_fkey
 foreign key(permission_code) references public.project_permission_catalog(permission_code);

create or replace function private.grant_project_membership(p_project_id uuid,p_user_id uuid,p_permission_codes text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_project public.projects; v_cm public.company_memberships; v_pm uuid; v_code text;
begin
 select * into v_project from public.projects where id=p_project_id for update;
 if not found or not private.is_company_super_admin(v_project.workspace_id) then raise exception 'Active Company Super Admin required'; end if;
 select * into v_cm from public.company_memberships where workspace_id=v_project.workspace_id and user_id=p_user_id and membership_status='ACTIVE' for update;
 if not found then raise exception 'User must have an active Company Membership before project assignment'; end if;
 insert into public.project_memberships(project_id,workspace_id,company_membership_id,user_id,assigned_by,membership_status)
 values(p_project_id,v_project.workspace_id,v_cm.id,p_user_id,(select auth.uid()),'ACTIVE')
 on conflict(project_id,company_membership_id) do update set membership_status='ACTIVE',assigned_by=excluded.assigned_by,updated_at=now()
 returning id into v_pm;
 delete from public.project_membership_permissions where project_membership_id=v_pm;
 foreach v_code in array coalesce(p_permission_codes,array[]::text[]) loop
  if not exists(select 1 from public.project_permission_catalog where permission_code=v_code and active) then
   raise exception 'Unknown or inactive project permission: %',v_code;
  end if;
  insert into public.project_membership_permissions(project_membership_id,permission_code,granted_by)
  values(v_pm,v_code,(select auth.uid()));
 end loop;
 return v_pm;
end $$;
revoke all on function private.grant_project_membership(uuid,uuid,text[]) from public,anon;
grant execute on function private.grant_project_membership(uuid,uuid,text[]) to authenticated;