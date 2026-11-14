-- Remove legacy blanket table grants as well as the public view grants.
-- RLS is not a substitute for removing unused anonymous DML/TRUNCATE privileges.
revoke all privileges on table public.documents from public,anon;
revoke all privileges on table public.document_signatures from public,anon;
revoke all privileges on table public.public_document_verification from public,anon,authenticated;
revoke select (
  verification_token,document_no,title,document_type,status,content_sha256,
  issued_at,created_at,period_start,period_end,signer_name,signer_role,
  company_name,approval_level,revoked_at
) on public.documents from anon;
revoke all privileges on table public.documents from anon;
revoke all privileges on table public.document_signatures from anon;
;
