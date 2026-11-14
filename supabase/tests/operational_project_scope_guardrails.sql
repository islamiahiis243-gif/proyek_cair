-- Proyek Cair operational project-scope guardrail checks.
-- Read-only assertions. No fixtures, dummy users, Companies, Workspaces, Projects,
-- BOQ rows, or audit events are created by this script.

do $$
declare
  v_rls_tables integer;
  v_scoped_policies integer;
  v_scope_triggers integer;
  v_gate boolean;
  v_catalog integer;
begin
  select count(*) into v_rls_tables
  from pg_class c
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public'
    and c.relname = any(array[
      'project_control','boq_sections','boq_items','boq_additions','item_schedules',
      'inventory_locations','inventory_transactions','inventory_transaction_reversals',
      'cash_transactions','progress_logs','safety_reports','project_media','documents',
      'document_signatures','transaction_attachments','project_personnel'
    ])
    and c.relrowsecurity;

  if v_rls_tables <> 16 then
    raise exception 'Expected RLS enabled on 16 operational tables; found %',v_rls_tables;
  end if;

  select count(*) into v_scoped_policies
  from pg_policies
  where schemaname='public'
    and tablename = any(array[
      'project_control','boq_sections','boq_items','boq_additions','item_schedules',
      'inventory_locations','inventory_transactions','inventory_transaction_reversals',
      'cash_transactions','progress_logs','safety_reports','project_media','documents',
      'document_signatures','transaction_attachments','project_personnel'
    ])
    and policyname like '%project_scope%';

  if v_scoped_policies < 80 then
    raise exception 'Expected at least 80 restrictive scope policies; found %',v_scoped_policies;
  end if;

  select count(*) into v_scope_triggers
  from information_schema.triggers
  where trigger_schema='public' and trigger_name like '%_scope_guard';

  if v_scope_triggers < 8 then
    raise exception 'Expected at least 8 parent-scope triggers; found %',v_scope_triggers;
  end if;

  select count(*) into v_catalog
  from public.project_permission_catalog
  where active;

  if v_catalog < 76 then
    raise exception 'Expected active permission catalog extensions; found % active codes',v_catalog;
  end if;

  v_gate := private.operational_project_scope_enabled();

  if not v_gate and not private.project_scope_guard(null,'project.read') then
    raise exception 'Legacy compatibility guard should pass while cutover gate is OFF';
  end if;

  if v_gate and private.project_scope_guard(null,'project.read') then
    raise exception 'Unscoped rows must be denied after cutover gate is ON';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='audit_logs' and column_name='workspace_id'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='audit_logs' and column_name='project_id'
  ) then
    raise exception 'Audit log scope columns are missing';
  end if;
end
$$;

-- Non-mutating readiness report. A non-zero blocker count is expected until the
-- Company/Workspace/Project are provisioned, backfill is approved, and callers migrate.
select private.operational_project_scope_readiness() as cutover_readiness;
