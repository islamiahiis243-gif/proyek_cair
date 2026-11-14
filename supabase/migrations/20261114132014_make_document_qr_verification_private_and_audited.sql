-- Private QR verification must be authenticated, tenant/project scoped,
-- and explicitly granted both scan and verify permissions (SSOT v3.1 §21.2).
drop policy if exists documents_public_verify on public.documents;
revoke select on public.public_document_verification from anon, authenticated;
revoke select (
  verification_token,document_no,title,document_type,status,content_sha256,
  issued_at,created_at,period_start,period_end,signer_name,signer_role,
  company_name,approval_level,revoked_at
) on public.documents from anon;

create or replace function private.verify_private_document_qr(p_token uuid)
returns table (
  document_no text,
  title text,
  document_type text,
  status text,
  content_sha256 text,
  issued_at timestamptz,
  created_at timestamptz,
  period_start date,
  period_end date,
  signer_name text,
  signer_role text,
  company_name text,
  approval_level text
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_doc public.documents%rowtype;
  v_outcome text;
begin
  if v_actor is null or p_token is null then
    return;
  end if;

  select d.* into v_doc
  from public.documents d
  where d.verification_token=p_token
  limit 1;

  if not found then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
    values(v_actor,'DOCUMENT_QR_VERIFY_DENIED','DOCUMENT_QR',null,
      jsonb_build_object('outcome','NOT_FOUND','source','PRIVATE_QR_ROUTE'));
    return;
  end if;

  if v_doc.status not in ('ISSUED','SIGNED')
     or v_doc.revoked_at is not null
     or v_doc.workspace_id is null
     or v_doc.project_id is null then
    v_outcome:='NOT_AVAILABLE';
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details,workspace_id,project_id)
    values(v_actor,'DOCUMENT_QR_VERIFY_DENIED','DOCUMENT_QR',v_doc.id::text,
      jsonb_build_object('outcome',v_outcome,'source','PRIVATE_QR_ROUTE'),
      v_doc.workspace_id,v_doc.project_id);
    return;
  end if;

  if not private.has_project_permission(v_doc.project_id,'document.qr.scan')
     or not private.has_project_permission(v_doc.project_id,'document.qr.verify') then
    insert into public.audit_logs(actor_id,action,entity_type,entity_id,details,workspace_id,project_id)
    values(v_actor,'DOCUMENT_QR_VERIFY_DENIED','DOCUMENT_QR',v_doc.id::text,
      jsonb_build_object('outcome','PERMISSION_DENIED','source','PRIVATE_QR_ROUTE'),
      v_doc.workspace_id,v_doc.project_id);
    return;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,details,workspace_id,project_id)
  values(v_actor,'DOCUMENT_QR_VERIFY_SUCCESS','DOCUMENT_QR',v_doc.id::text,
    jsonb_build_object('outcome','VERIFIED','source','PRIVATE_QR_ROUTE',
      'permission_codes',jsonb_build_array('document.qr.scan','document.qr.verify')),
    v_doc.workspace_id,v_doc.project_id);

  return query
  select v_doc.document_no,v_doc.title,v_doc.document_type,v_doc.status,
    v_doc.content_sha256,v_doc.issued_at,v_doc.created_at,v_doc.period_start,
    v_doc.period_end,v_doc.signer_name,v_doc.signer_role,v_doc.company_name,
    v_doc.approval_level;
end
$$;

revoke all on function private.verify_private_document_qr(uuid) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.verify_private_document_qr(uuid) to authenticated;

create or replace function public.verify_private_document_qr(p_token uuid)
returns table (
  document_no text,
  title text,
  document_type text,
  status text,
  content_sha256 text,
  issued_at timestamptz,
  created_at timestamptz,
  period_start date,
  period_end date,
  signer_name text,
  signer_role text,
  company_name text,
  approval_level text
)
language sql
security invoker
set search_path=''
as $$
  select * from private.verify_private_document_qr(p_token)
$$;
revoke all on function public.verify_private_document_qr(uuid) from public,anon;
grant execute on function public.verify_private_document_qr(uuid) to authenticated;
;
