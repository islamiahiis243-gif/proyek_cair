drop policy if exists operational_project_scope_control_deny_all on private.operational_project_scope_control;
create policy operational_project_scope_control_deny_all
on private.operational_project_scope_control
for all to public
using(false)
with check(false);;
