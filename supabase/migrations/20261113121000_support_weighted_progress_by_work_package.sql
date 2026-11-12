alter table public.progress_logs drop constraint if exists progress_logs_week_start_week_end_key;
alter table public.progress_logs add column if not exists work_package text not null default 'Pekerjaan keseluruhan';
alter table public.progress_logs add column if not exists weight_percent numeric(7,4) not null default 100 check(weight_percent between 0 and 100);
create index if not exists progress_logs_package_week_idx on public.progress_logs(work_package,week_start);
