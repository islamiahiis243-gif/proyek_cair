create schema if not exists private;

-- A fail-closed rollout switch. It is deliberately OFF until canonical IDs,
-- audited backfill, Storage paths, and privileged RPCs are ready.
create table if not exists private.operational_project_scope_control (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  enabled_at timestamptz,
  enabled_by uuid references auth.users(id)
);
insert into private.operational_project_scope_control(singleton,enabled)
values(true,false) on conflict(singleton) do nothing;
alter table private.operational_project_scope_control enable row level security;
revoke all on private.operational_project_scope_control from public, anon, authenticated;

create or replace function private.operational_project_scope_enabled()
returns boolean language sql stable security definer set search_path=''
as $$
  select coalesce((select c.enabled
    from private.operational_project_scope_control c
    where c.singleton=true),false)
$$;
revoke all on function private.operational_project_scope_enabled() from public, anon;
grant execute on function private.operational_project_scope_enabled() to authenticated;

create or replace function private.project_scope_guard(p_project_id uuid,p_permission_code text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
begin
  if not private.operational_project_scope_enabled() then
    return true;
  end if;
  if p_project_id is null or p_permission_code is null then
    return false;
  end if;
  return private.has_project_permission(p_project_id,p_permission_code);
end
$$;
revoke all on function private.project_scope_guard(uuid,text) from public, anon;
grant execute on function private.project_scope_guard(uuid,text) to authenticated;

create or replace function private.attachment_project_scope_guard(
  p_project_id uuid,p_transaction_kind text,p_action text
) returns boolean language plpgsql stable security definer set search_path=''
as $$
declare v_permission text;
begin
  if not private.operational_project_scope_enabled() then return true; end if;
  if p_project_id is null then return false; end if;
  if p_transaction_kind='INVENTORY' then
    v_permission := case p_action
      when 'read' then 'inventory.read'
      when 'create' then 'inventory.movement.create'
      else null end;
  elsif p_transaction_kind='CASH' then
    v_permission := case p_action
      when 'read' then 'cash.read'
      when 'create' then 'cash.transaction.create'
      else null end;
  else
    return false;
  end if;
  return private.project_scope_guard(p_project_id,v_permission);
end
$$;
revoke all on function private.attachment_project_scope_guard(uuid,text,text) from public, anon;
grant execute on function private.attachment_project_scope_guard(uuid,text,text) to authenticated;

-- The trigger derives child scope from authoritative parent rows; callers cannot
-- attach a child row to a different project by submitting arbitrary scope keys.
create or replace function private.enforce_operational_project_scope()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
  v_workspace uuid;
  v_project uuid;
  v_workspace2 uuid;
  v_project2 uuid;
begin
  if tg_table_name='boq_items' and new.parent_section_id is not null then
    select s.workspace_id,s.project_id into v_workspace,v_project
      from public.boq_sections s where s.id=new.parent_section_id;
  elsif tg_table_name='boq_additions' and new.item_id is not null then
    select i.workspace_id,i.project_id into v_workspace,v_project
      from public.boq_items i where i.id=new.item_id;
  elsif tg_table_name='item_schedules' then
    select i.workspace_id,i.project_id into v_workspace,v_project
      from public.boq_items i where i.id=new.item_id;
  elsif tg_table_name='inventory_transactions' then
    select i.workspace_id,i.project_id into v_workspace,v_project
      from public.boq_items i where i.id=new.item_id;
  elsif tg_table_name='inventory_transaction_reversals' then
    select t.workspace_id,t.project_id into v_workspace,v_project
      from public.inventory_transactions t where t.id=new.original_transaction_id;
    select t.workspace_id,t.project_id into v_workspace2,v_project2
      from public.inventory_transactions t where t.id=new.reversal_transaction_id;
    if v_project is not null and v_project2 is not null
       and (v_workspace,v_project) is distinct from (v_workspace2,v_project2) then
      raise exception 'Inventory original and reversal must belong to the same project';
    end if;
    if v_project is null then v_workspace:=v_workspace2; v_project:=v_project2; end if;
  elsif tg_table_name='project_media' then
    if new.linked_progress_id is not null then
      select p.workspace_id,p.project_id into v_workspace,v_project
        from public.progress_logs p where p.id=new.linked_progress_id;
    end if;
    if new.linked_safety_id is not null then
      select s.workspace_id,s.project_id into v_workspace2,v_project2
        from public.safety_reports s where s.id=new.linked_safety_id;
      if v_project is not null and v_project2 is not null
         and (v_workspace,v_project) is distinct from (v_workspace2,v_project2) then
        raise exception 'Media parent records must belong to the same project';
      end if;
      if v_project is null then v_workspace:=v_workspace2; v_project:=v_project2; end if;
    end if;
  elsif tg_table_name='document_signatures' then
    select d.workspace_id,d.project_id into v_workspace,v_project
      from public.documents d where d.id=new.document_id;
  elsif tg_table_name='transaction_attachments' then
    if new.transaction_kind='INVENTORY' then
      select t.workspace_id,t.project_id into v_workspace,v_project
        from public.inventory_transactions t where t.id=new.transaction_id;
    elsif new.transaction_kind='CASH' then
      select t.workspace_id,t.project_id into v_workspace,v_project
        from public.cash_transactions t where t.id=new.transaction_id;
    else
      raise exception 'Unsupported transaction attachment parent type';
    end if;
  end if;

  if v_project is not null then
    if new.project_id is null and new.workspace_id is null then
      new.project_id:=v_project;
      new.workspace_id:=v_workspace;
    elsif (new.workspace_id,new.project_id) is distinct from (v_workspace,v_project) then
      raise exception 'Child row scope must match its parent project';
    end if;
  end if;

  if private.operational_project_scope_enabled()
     and (new.workspace_id is null or new.project_id is null) then
    raise exception 'Active project scope is required for %',tg_table_name;
  end if;

  if tg_table_name='inventory_transactions' then
    if new.source_location_id is not null then
      select l.workspace_id,l.project_id into v_workspace,v_project
        from public.inventory_locations l where l.id=new.source_location_id;
      if v_project is not null and (new.workspace_id,new.project_id) is distinct from (v_workspace,v_project) then
        raise exception 'Inventory source location must belong to the transaction project';
      end if;
    end if;
    if new.destination_location_id is not null then
      select l.workspace_id,l.project_id into v_workspace,v_project
        from public.inventory_locations l where l.id=new.destination_location_id;
      if v_project is not null and (new.workspace_id,new.project_id) is distinct from (v_workspace,v_project) then
        raise exception 'Inventory destination location must belong to the transaction project';
      end if;
    end if;
  end if;

  return new;
end
$$;
revoke all on function private.enforce_operational_project_scope() from public, anon, authenticated;

-- Scope columns for the audit stream are additive. Legacy events remain
-- unscoped until their entity references can be resolved during cutover.
alter table public.audit_logs
  add column if not exists workspace_id uuid references public.workspaces(id),
  add column if not exists project_id uuid;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='audit_logs_project_workspace_fkey') then
    alter table public.audit_logs add constraint audit_logs_project_workspace_fkey
      foreign key(project_id,workspace_id) references public.projects(id,workspace_id);
  end if;
  if not exists(select 1 from pg_constraint where conname='audit_logs_project_scope_pair_check') then
    alter table public.audit_logs add constraint audit_logs_project_scope_pair_check
      check ((project_id is null)=(workspace_id is null));
  end if;
end $$;
create index if not exists audit_logs_project_scope_idx
  on public.audit_logs(project_id,workspace_id);

-- Add two explicit actions missing from the initial catalog for media upload
-- and inventory location administration.
insert into public.project_permission_catalog
(permission_code,module,action,risk_level,requires_authority_check,active,description)
values
('project.media.create','project','media.create','MEDIUM',false,true,'Upload project media/evidence within the active project'),
('inventory.location.manage','inventory','location.manage','MEDIUM',false,true,'Create or update project inventory locations')
on conflict(permission_code) do update set
 module=excluded.module,action=excluded.action,risk_level=excluded.risk_level,
 requires_authority_check=excluded.requires_authority_check,active=true,
 description=excluded.description;

-- Trigger-based scope inheritance and parent consistency.
do $$
declare t text;
begin
  foreach t in array array[
    'boq_items','boq_additions','item_schedules','inventory_transactions',
    'inventory_transaction_reversals','project_media','document_signatures',
    'transaction_attachments'
  ] loop
    execute format('drop trigger if exists %I on public.%I',t||'_scope_guard',t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function private.enforce_operational_project_scope()',t||'_scope_guard',t);
  end loop;
end $$;

-- Gate all 16 operational tables with RESTRICTIVE policies. The old policies
-- remain in place while the gate is OFF, so no legacy workflow is removed.
-- After activation, every command must also satisfy explicit project permission.
do $$
declare r record;
begin
  for r in
    select * from (values
      ('project_control','project.read',null,'project.update'),
      ('boq_sections','boq.read','boq.create','boq.update'),
      ('boq_items','boq.read','boq.create','boq.update'),
      ('boq_additions','boq.read','boq.addition.create','boq.update'),
      ('item_schedules','procurement.read','procurement.create','procurement.update'),
      ('inventory_locations','inventory.read','inventory.location.manage','inventory.location.manage'),
      ('inventory_transactions','inventory.read','inventory.movement.create',null),
      ('inventory_transaction_reversals','inventory.read',null,null),
      ('cash_transactions','cash.read','cash.transaction.create',null),
      ('progress_logs','progress.read','progress.create','progress.update'),
      ('safety_reports','k3.read','k3.report.create','k3.report.update'),
      ('project_media','project.read','project.media.create',null),
      ('documents','document.read','document.create','document.update'),
      ('document_signatures','document.read',null,null),
      ('transaction_attachments','project.read','project.read',null),
      ('project_personnel','project.read','project.assign','project.assign')
    ) as x(table_name,read_permission,insert_permission,update_permission)
  loop
    execute format('drop policy if exists %I on public.%I',r.table_name||'_project_scope_select_guard',r.table_name);
    execute format('create policy %I on public.%I as restrictive for select to authenticated using (private.project_scope_guard(project_id,%L))',
      r.table_name||'_project_scope_select_guard',r.table_name,r.read_permission);

    execute format('drop policy if exists %I on public.%I',r.table_name||'_project_scope_insert_guard',r.table_name);
    if r.table_name='transaction_attachments' then
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (private.attachment_project_scope_guard(project_id,transaction_kind,''create''))',
        r.table_name||'_project_scope_insert_guard',r.table_name);
    else
      execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (private.project_scope_guard(project_id,%L))',
        r.table_name||'_project_scope_insert_guard',r.table_name,r.insert_permission);
    end if;

    execute format('drop policy if exists %I on public.%I',r.table_name||'_project_scope_update_guard',r.table_name);
    if r.table_name='transaction_attachments' or r.update_permission is null then
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (private.project_scope_guard(project_id,null)) with check (private.project_scope_guard(project_id,null))',
        r.table_name||'_project_scope_update_guard',r.table_name);
    else
      execute format('create policy %I on public.%I as restrictive for update to authenticated using (private.project_scope_guard(project_id,%L)) with check (private.project_scope_guard(project_id,%L))',
        r.table_name||'_project_scope_update_guard',r.table_name,r.update_permission,r.update_permission);
    end if;

    execute format('drop policy if exists %I on public.%I',r.table_name||'_project_scope_delete_guard',r.table_name);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (private.project_scope_guard(project_id,null))',
      r.table_name||'_project_scope_delete_guard',r.table_name);

    execute format('drop policy if exists %I on public.%I',r.table_name||'_anon_deny_project_scope',r.table_name);
    execute format('create policy %I on public.%I as restrictive for all to anon using (false) with check (false)',
      r.table_name||'_anon_deny_project_scope',r.table_name);
  end loop;
end $$;

-- Related resources inherit scope through their parent row; the trigger above
-- stamps the paired keys, so the same restrictive project policy applies.
-- Documents' legacy anonymous QR/select path is also constrained by the anon
-- deny policy above and becomes private when scope enforcement is activated.

-- Project Evidence storage paths must become <project_uuid>/<user_id>/... .
-- Until then, the gate remains OFF. When ON, no legacy user-id-first path passes.
create or replace function private.storage_project_scope_guard(p_name text,p_permission_code text)
returns boolean language plpgsql stable security definer set search_path=''
as $$
declare v_folder text;
begin
  if not private.operational_project_scope_enabled() then return true; end if;
  v_folder := (storage.foldername(p_name))[1];
  if v_folder is null or v_folder !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return private.project_scope_guard(v_folder::uuid,p_permission_code);
end
$$;
revoke all on function private.storage_project_scope_guard(text,text) from public, anon;
grant execute on function private.storage_project_scope_guard(text,text) to authenticated;

drop policy if exists project_evidence_project_scope_select_guard on storage.objects;
create policy project_evidence_project_scope_select_guard on storage.objects
  as restrictive for select to authenticated
  using (bucket_id<>'project-evidence' or private.storage_project_scope_guard(name,'project.read'));
drop policy if exists project_evidence_project_scope_insert_guard on storage.objects;
create policy project_evidence_project_scope_insert_guard on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id<>'project-evidence' or private.storage_project_scope_guard(name,'project.media.create'));
drop policy if exists project_evidence_project_scope_update_guard on storage.objects;
create policy project_evidence_project_scope_update_guard on storage.objects
  as restrictive for update to authenticated
  using (bucket_id<>'project-evidence' or private.storage_project_scope_guard(name,null))
  with check (bucket_id<>'project-evidence' or private.storage_project_scope_guard(name,null));
drop policy if exists project_evidence_project_scope_delete_guard on storage.objects;
create policy project_evidence_project_scope_delete_guard on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id<>'project-evidence' or private.storage_project_scope_guard(name,null));
drop policy if exists project_evidence_anon_deny_scope on storage.objects;
create policy project_evidence_anon_deny_scope on storage.objects
  as restrictive for all to anon
  using (bucket_id<>'project-evidence') with check (bucket_id<>'project-evidence');

-- Readiness report is intentionally non-mutating and excludes PII/key material.
create or replace function private.operational_project_scope_readiness()
returns jsonb language plpgsql stable security definer set search_path=''
as $$
declare
  v_unscoped jsonb;
  v_audit_unscoped bigint;
  v_storage_unmapped bigint;
  v_projects_without_reader bigint;
  v_unsafe_definer_rpcs text[];
begin
  select jsonb_object_agg(table_name,unscoped_count) into v_unscoped
  from (
    select x.table_name,
      (to_jsonb(nullif(x.table_name,'')::text)::text is null)::int as unused,
      case x.table_name
        when 'project_control' then (select count(*) from public.project_control where workspace_id is null or project_id is null)
        when 'boq_sections' then (select count(*) from public.boq_sections where workspace_id is null or project_id is null)
        when 'boq_items' then (select count(*) from public.boq_items where workspace_id is null or project_id is null)
        when 'boq_additions' then (select count(*) from public.boq_additions where workspace_id is null or project_id is null)
        when 'item_schedules' then (select count(*) from public.item_schedules where workspace_id is null or project_id is null)
        when 'inventory_locations' then (select count(*) from public.inventory_locations where workspace_id is null or project_id is null)
        when 'inventory_transactions' then (select count(*) from public.inventory_transactions where workspace_id is null or project_id is null)
        when 'inventory_transaction_reversals' then (select count(*) from public.inventory_transaction_reversals where workspace_id is null or project_id is null)
        when 'cash_transactions' then (select count(*) from public.cash_transactions where workspace_id is null or project_id is null)
        when 'progress_logs' then (select count(*) from public.progress_logs where workspace_id is null or project_id is null)
        when 'safety_reports' then (select count(*) from public.safety_reports where workspace_id is null or project_id is null)
        when 'project_media' then (select count(*) from public.project_media where workspace_id is null or project_id is null)
        when 'documents' then (select count(*) from public.documents where workspace_id is null or project_id is null)
        when 'document_signatures' then (select count(*) from public.document_signatures where workspace_id is null or project_id is null)
        when 'transaction_attachments' then (select count(*) from public.transaction_attachments where workspace_id is null or project_id is null)
        when 'project_personnel' then (select count(*) from public.project_personnel where workspace_id is null or project_id is null)
      end as unscoped_count
    from (values
      ('project_control'),('boq_sections'),('boq_items'),('boq_additions'),('item_schedules'),
      ('inventory_locations'),('inventory_transactions'),('inventory_transaction_reversals'),
      ('cash_transactions'),('progress_logs'),('safety_reports'),('project_media'),('documents'),
      ('document_signatures'),('transaction_attachments'),('project_personnel')
    ) x(table_name)
  ) q;

  select count(*) into v_audit_unscoped
    from public.audit_logs where workspace_id is null or project_id is null;

  select count(*) into v_storage_unmapped
    from storage.objects o
    where o.bucket_id='project-evidence'
      and (
        (storage.foldername(o.name))[1] is null
        or (storage.foldername(o.name))[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or not exists(select 1 from public.projects p where p.id=(storage.foldername(o.name))[1]::uuid)
      );

  select count(*) into v_projects_without_reader
  from (
    select distinct p.id
    from public.projects p
    where exists (
      select 1 from public.project_control r where r.project_id=p.id
      union all select 1 from public.boq_sections r where r.project_id=p.id
      union all select 1 from public.boq_items r where r.project_id=p.id
      union all select 1 from public.boq_additions r where r.project_id=p.id
      union all select 1 from public.item_schedules r where r.project_id=p.id
      union all select 1 from public.inventory_locations r where r.project_id=p.id
      union all select 1 from public.inventory_transactions r where r.project_id=p.id
      union all select 1 from public.inventory_transaction_reversals r where r.project_id=p.id
      union all select 1 from public.cash_transactions r where r.project_id=p.id
      union all select 1 from public.progress_logs r where r.project_id=p.id
      union all select 1 from public.safety_reports r where r.project_id=p.id
      union all select 1 from public.project_media r where r.project_id=p.id
      union all select 1 from public.documents r where r.project_id=p.id
      union all select 1 from public.document_signatures r where r.project_id=p.id
      union all select 1 from public.transaction_attachments r where r.project_id=p.id
      union all select 1 from public.project_personnel r where r.project_id=p.id
    )
    and not exists (
      select 1 from public.project_memberships pm
      join public.company_memberships cm on cm.id=pm.company_membership_id and cm.workspace_id=pm.workspace_id
      join public.project_membership_permissions pp on pp.project_membership_id=pm.id
      join public.project_permission_catalog pc on pc.permission_code=pp.permission_code and pc.active
      where pm.project_id=p.id and pm.membership_status='ACTIVE'
        and cm.membership_status='ACTIVE' and pp.permission_code='project.read'
    )
  ) blocked;

  select array_agg(x.sig) into v_unsafe_definer_rpcs
  from (values
    ('public.create_boq_addition(uuid,text,numeric,text,numeric,text,text,text,text,text,boolean,text)'::text),
    ('public.record_cash_mutation(uuid,text,numeric,timestamptz,text,text,text,text,text)'::text),
    ('public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text)'::text),
    ('public.record_inventory_mutation_v2(uuid,uuid,text,numeric,timestamptz,text,text,text,text,text,text,text,text,text,uuid)'::text),
    ('public.reverse_inventory_transaction(uuid,text,uuid)'::text)
  ) x(sig)
  where pg_catalog.to_regprocedure(x.sig) is not null
    and pg_catalog.has_function_privilege('authenticated',pg_catalog.to_regprocedure(x.sig),'EXECUTE');

  return jsonb_build_object(
    'scope_gate_enabled',private.operational_project_scope_enabled(),
    'unscoped_operational_rows',coalesce(v_unscoped,'{}'::jsonb),
    'unscoped_audit_rows',v_audit_unscoped,
    'unmapped_project_evidence_objects',v_storage_unmapped,
    'projects_with_operational_rows_without_explicit_project_read_grant',v_projects_without_reader,
    'authenticated_executable_legacy_security_definer_mutations',coalesce(to_jsonb(v_unsafe_definer_rpcs),'[]'::jsonb)
  );
end
$$;
revoke all on function private.operational_project_scope_readiness() from public, anon;
grant execute on function private.operational_project_scope_readiness() to authenticated;

create or replace function private.activate_operational_project_scope()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_report jsonb;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.platform_admins p where p.user_id=(select auth.uid())
  ) then
    raise exception 'Platform Super Admin required';
  end if;
  v_report:=private.operational_project_scope_readiness();
  if (v_report->>'scope_gate_enabled')::boolean then
    raise exception 'Project scope enforcement is already enabled; it cannot be disabled through this endpoint';
  end if;
  if (v_report->'unscoped_operational_rows') <> '{}'::jsonb
     and exists (
       select 1 from jsonb_each_text(v_report->'unscoped_operational_rows') e where e.value::bigint>0
     ) then
    raise exception 'Cutover blocked: operational rows still lack canonical scope IDs. Read private.operational_project_scope_readiness()';
  end if;
  if (v_report->>'unscoped_audit_rows')::bigint>0 then
    raise exception 'Cutover blocked: audit events still lack canonical tenant/project scope';
  end if;
  if (v_report->>'unmapped_project_evidence_objects')::bigint>0 then
    raise exception 'Cutover blocked: project-evidence Storage paths are not project-prefixed';
  end if;
  if (v_report->>'projects_with_operational_rows_without_explicit_project_read_grant')::bigint>0 then
    raise exception 'Cutover blocked: at least one operational project has no explicit project.read membership grant';
  end if;
  if jsonb_array_length(v_report->'authenticated_executable_legacy_security_definer_mutations')>0 then
    raise exception 'Cutover blocked: legacy SECURITY DEFINER mutation RPCs still bypass project-scoped RLS';
  end if;
  update private.operational_project_scope_control
    set enabled=true,enabled_at=now(),enabled_by=(select auth.uid())
    where singleton=true and enabled=false;
  return jsonb_build_object('enabled',true,'enabled_at',now());
end
$$;
revoke all on function private.activate_operational_project_scope() from public, anon, authenticated;
grant execute on function private.activate_operational_project_scope() to authenticated;

create or replace function public.activate_operational_project_scope()
returns jsonb language sql set search_path=''
as $$ select private.activate_operational_project_scope() $$;
revoke all on function public.activate_operational_project_scope() from public, anon;
grant execute on function public.activate_operational_project_scope() to authenticated;;
