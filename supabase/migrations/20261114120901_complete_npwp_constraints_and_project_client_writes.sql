-- Close remaining write/constraint gaps in the first Project Registry release.
alter table public.companies add constraint companies_npwp_required_check check (
 registration_status in ('LEGACY_UNVERIFIED','VERIFIED')
 or (
  npwp_ciphertext is not null
  and npwp_last4 ~ '^[0-9]{4}$'
  and npwp_fingerprint ~ '^[0-9a-f]{64}$'
 )
);
alter table public.company_admin_seats add constraint company_admin_seat_email_format_check
 check(length(recipient_email)<=254 and recipient_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$');

-- The registration RPC is the sole supported submission path; do not allow direct table inserts.
revoke insert on public.company_registration_requests from authenticated;

-- RLS already restricts all client-relationship writes to the Company Super Admin of that project.
grant insert,update,delete on public.project_client_relationships to authenticated;