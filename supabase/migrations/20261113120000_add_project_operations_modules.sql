-- Project progress, HSE, field evidence, approvals, personnel, and offline metadata.
-- Security is row-scoped by authenticated identity and existing project roles.
create extension if not exists pgcrypto;
create table if not exists public.progress_logs (
 id uuid primary key default gen_random_uuid(), client_key uuid not null default gen_random_uuid() unique,
 week_start date not null, week_end date not null,
 planned_percent numeric(7,4) not null default 0 check(planned_percent between 0 and 100),
 actual_percent numeric(7,4) not null default 0 check(actual_percent between 0 and 100),
 weighted_value numeric(16,2) not null default 0 check(weighted_value>=0),
 weather_condition text, manpower integer not null default 0 check(manpower>=0),
 description text not null, created_by uuid not null references auth.users(id),
 approved_by uuid references auth.users(id), approved_at timestamptz,
 status text not null default 'DRAFT' check(status in ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
 created_at timestamptz not null default now(), unique(week_start,week_end), check(week_end>=week_start)
);
create table if not exists public.safety_reports (
 id uuid primary key default gen_random_uuid(), client_key uuid not null default gen_random_uuid() unique,
 report_type text not null check(report_type in ('TOOLBOX_MEETING','WORK_PERMIT','HAZARD_REPORT','INCIDENT')),
 report_date timestamptz not null default now(), title text not null,
 severity text not null default 'LOW' check(severity in ('LOW','MEDIUM','HIGH','CRITICAL')),
 description text not null, action_taken text, permit_type text, location text,
 status text not null default 'OPEN' check(status in ('OPEN','IN_PROGRESS','CLOSED','CANCELLED')),
 reported_by uuid not null references auth.users(id), reviewed_by uuid references auth.users(id), reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.project_media (
 id uuid primary key default gen_random_uuid(), phase text not null check(phase in ('BEFORE','DURING','AFTER','GENERAL')),
 caption text not null, storage_path text not null, latitude double precision, longitude double precision,
 captured_at timestamptz not null default now(), linked_progress_id uuid references public.progress_logs(id) on delete set null,
 linked_safety_id uuid references public.safety_reports(id) on delete set null, created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 check((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);
create table if not exists public.document_signatures (
 id uuid primary key default gen_random_uuid(), document_id uuid not null references public.documents(id) on delete cascade,
 signer_id uuid not null references auth.users(id), signer_name text not null, signer_role text not null,
 company text not null, authority_level text not null check(authority_level in ('MINOR','MAJOR')),
 decision text not null check(decision in ('APPROVED','REJECTED')), note text, snapshot_sha256 text not null,
 signed_at timestamptz not null default now(), unique(document_id,signer_id)
);
alter table public.documents add column if not exists verification_token uuid default gen_random_uuid();
alter table public.documents add column if not exists company_name text;
alter table public.documents add column if not exists approval_level text default 'MINOR';
alter table public.documents add column if not exists revoked_at timestamptz;
alter table public.inventory_transactions add column if not exists attachment_path text;
alter table public.cash_transactions add column if not exists attachment_path text;
alter table public.profiles add column if not exists company text;
alter table public.profiles add column if not exists job_title text;
alter table public.profiles add column if not exists authority_level text default 'NONE';
alter table public.profiles add column if not exists phone text;
create table if not exists public.project_personnel (
 id uuid primary key default gen_random_uuid(), full_name text not null,
 company text not null check(company in ('PT IMK','CV Menara Megah')), job_title text not null,
 project_role text not null, authority_level text not null default 'NONE' check(authority_level in ('NONE','MINOR','MAJOR')),
 email text, phone text, linked_user_id uuid references auth.users(id), is_active boolean not null default true,
 notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index if not exists project_personnel_linked_user_uidx on public.project_personnel(linked_user_id) where linked_user_id is not null;
create index if not exists progress_logs_week_idx on public.progress_logs(week_start);
create index if not exists safety_reports_date_idx on public.safety_reports(report_date desc);
create index if not exists project_media_created_idx on public.project_media(created_at desc);
create index if not exists document_signatures_document_idx on public.document_signatures(document_id,signed_at);
alter table public.progress_logs enable row level security;
alter table public.safety_reports enable row level security;
alter table public.project_media enable row level security;
alter table public.document_signatures enable row level security;
alter table public.project_personnel enable row level security;
drop policy if exists progress_read_authenticated on public.progress_logs;
create policy progress_read_authenticated on public.progress_logs for select to authenticated using(true);
drop policy if exists progress_write_roles on public.progress_logs;
create policy progress_write_roles on public.progress_logs for insert to authenticated with check(public.current_user_role() in ('admin','site_manager','storekeeper'));
drop policy if exists progress_update_roles on public.progress_logs;
create policy progress_update_roles on public.progress_logs for update to authenticated using(public.current_user_role() in ('admin','site_manager')) with check(public.current_user_role() in ('admin','site_manager'));
drop policy if exists safety_read_authenticated on public.safety_reports;
create policy safety_read_authenticated on public.safety_reports for select to authenticated using(true);
drop policy if exists safety_insert_authenticated on public.safety_reports;
create policy safety_insert_authenticated on public.safety_reports for insert to authenticated with check(auth.uid()=reported_by);
drop policy if exists safety_update_roles on public.safety_reports;
create policy safety_update_roles on public.safety_reports for update to authenticated using(public.current_user_role() in ('admin','site_manager')) with check(public.current_user_role() in ('admin','site_manager'));
drop policy if exists media_read_authenticated on public.project_media;
create policy media_read_authenticated on public.project_media for select to authenticated using(true);
drop policy if exists media_insert_authenticated on public.project_media;
create policy media_insert_authenticated on public.project_media for insert to authenticated with check(auth.uid()=created_by);
drop policy if exists media_delete_admin on public.project_media;
create policy media_delete_admin on public.project_media for delete to authenticated using(public.current_user_role()='admin');
drop policy if exists signatures_read_authenticated on public.document_signatures;
create policy signatures_read_authenticated on public.document_signatures for select to authenticated using(true);
drop policy if exists signatures_insert_authorized on public.document_signatures;
create policy signatures_insert_authorized on public.document_signatures for insert to authenticated with check(auth.uid()=signer_id and exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active=true and p.authority_level in ('MINOR','MAJOR')));
drop policy if exists personnel_read_authenticated on public.project_personnel;
create policy personnel_read_authenticated on public.project_personnel for select to authenticated using(true);
drop policy if exists personnel_manage_admin on public.project_personnel;
create policy personnel_manage_admin on public.project_personnel for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
drop policy if exists documents_public_verify on public.documents;
create policy documents_public_verify on public.documents for select to anon using(status in ('ISSUED','SIGNED') and revoked_at is null and verification_token is not null);
create or replace view public.public_document_verification with (security_invoker=true) as
select verification_token,document_no,title,document_type,status,content_sha256,issued_at,created_at,period_start,period_end,signer_name,signer_role,company_name,approval_level,revoked_at
from public.documents where status in ('ISSUED','SIGNED') and revoked_at is null;
grant select (verification_token,document_no,title,document_type,status,content_sha256,issued_at,created_at,period_start,period_end,signer_name,signer_role,company_name,approval_level,revoked_at) on public.documents to anon;
grant select on public.public_document_verification to anon,authenticated;
grant select,insert,update on public.progress_logs,public.safety_reports,public.project_media,public.document_signatures,public.project_personnel to authenticated;
create table if not exists public.transaction_attachments (
 id uuid primary key default gen_random_uuid(), transaction_kind text not null check(transaction_kind in ('INVENTORY','CASH')),
 transaction_id uuid not null, storage_path text not null, file_name text not null, mime_type text not null,
 uploaded_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
alter table public.transaction_attachments enable row level security;
drop policy if exists transaction_attachments_read_auth on public.transaction_attachments;
create policy transaction_attachments_read_auth on public.transaction_attachments for select to authenticated using(true);
drop policy if exists transaction_attachments_insert_auth on public.transaction_attachments;
create policy transaction_attachments_insert_auth on public.transaction_attachments for insert to authenticated with check(auth.uid()=uploaded_by);
grant select,insert on public.transaction_attachments to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('project-evidence','project-evidence',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];
drop policy if exists project_evidence_read_auth on storage.objects;
create policy project_evidence_read_auth on storage.objects for select to authenticated using(bucket_id='project-evidence');
drop policy if exists project_evidence_insert_auth on storage.objects;
create policy project_evidence_insert_auth on storage.objects for insert to authenticated with check(bucket_id='project-evidence');
drop policy if exists project_evidence_delete_admin on storage.objects;
create policy project_evidence_delete_admin on storage.objects for delete to authenticated using(bucket_id='project-evidence' and public.current_user_role()='admin');
insert into public.project_personnel(full_name,company,job_title,project_role,authority_level,notes)
select v.full_name,v.company,v.job_title,v.project_role,v.authority_level,'Roster awal dari implementation plan; tautkan ke akun Auth setelah email resmi tersedia.'
from (values
('Pak Sutarno','PT IMK','Direktur','DIRECTOR_IMK','MAJOR'),('Pak Hendro','PT IMK','Kepala Teknik Tambang','KTT_IMK','MAJOR'),
('Pak Arif','PT IMK','General Manager / Project Manager','GM_IMK','MAJOR'),('Pak Amiluddin','PT IMK','Manager SCM / Procurement','SCM_IMK','MINOR'),
('Pengawas Lapangan IMK','PT IMK','Pengawas Lapangan','SUPERVISOR_IMK','MINOR'),('Pak Rolly','CV Menara Megah','Direktur','DIRECTOR_MM','MAJOR'),
('Pak Andi Wilis','CV Menara Megah','Construction Manager / Project Manager','CM_MM','MAJOR'),('Pak Jodi Sinagar','CV Menara Megah','QC Inspector','QC_MM','MINOR'),
('Pak Rico Simanjuntak','CV Menara Megah','Drafter','DRAFTER_MM','NONE'),('Pak Jhon','CV Menara Megah','Site Engineer','SITE_ENGINEER_MM','MINOR'),
('Ibu Erma','CV Menara Megah','Safety Officer K3','SAFETY_MM','MINOR'),('Petugas Logistik Gudang Site','CV Menara Megah','Logistik & Gudang','LOGISTIC_MM','NONE'),
('Kasir Operasional','CV Menara Megah','Kasir Operasional','FINANCE_MM','NONE')
) as v(full_name,company,job_title,project_role,authority_level)
where not exists(select 1 from public.project_personnel p where p.full_name=v.full_name and p.company=v.company);
