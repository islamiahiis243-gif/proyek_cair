-- UDU core foundation. BOQ quantity is a contract reference, never opening stock.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 role text not null default 'viewer' check (role in ('admin','site_manager','storekeeper','finance','auditor','viewer')),
 is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.boq_items (
 id uuid primary key default gen_random_uuid(), boq_code text not null unique, description text not null,
 category text, quantity numeric(18,4) not null default 0 check(quantity >= 0), uom text not null,
 unit_rate numeric(18,2) not null default 0 check(unit_rate >= 0), remarks text,
 source_sheet text not null default 'Trainer & UDU Office',
 source_row integer, is_active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint boq_items_source_sheet_check check(source_sheet = 'Trainer & UDU Office')
);
create table if not exists public.inventory_transactions (
 id uuid primary key default gen_random_uuid(), idempotency_key uuid not null unique,
 item_id uuid not null references public.boq_items(id),
 transaction_type text not null check(transaction_type in ('MASUK','KELUAR','PENYESUAIAN_MASUK','PENYESUAIAN_KELUAR')),
 quantity numeric(18,4) not null check(quantity > 0), uom text not null, occurred_at timestamptz not null default now(),
 reference_no text, counterparty text, location text, notes text,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists inventory_transactions_item_time_idx on public.inventory_transactions(item_id, occurred_at desc);
create table if not exists public.cash_transactions (
 id uuid primary key default gen_random_uuid(), idempotency_key uuid not null unique,
 transaction_type text not null check(transaction_type in ('MASUK','KELUAR')),
 amount numeric(18,2) not null check(amount > 0), occurred_at timestamptz not null default now(),
 category text, description text not null, reference_no text,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table if not exists public.documents (
 id uuid primary key default gen_random_uuid(), document_no text not null unique, title text not null,
 document_type text, status text not null default 'DRAFT'
 check(status in ('DRAFT','SUBMITTED','REVIEWED','APPROVED','SIGNED','ISSUED','REJECTED','REVOKED')),
 storage_path text, content_sha256 text, issued_at timestamptz,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id bigint generated always as identity primary key, actor_id uuid references auth.users(id),
 action text not null, entity_type text not null, entity_id text, details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create or replace function public.current_user_role() returns text language sql stable security definer set search_path=public as $$
 select role from public.profiles where id=auth.uid() and is_active=true
$$;
create or replace function public.record_inventory_mutation(
 p_idempotency_key uuid,p_item_id uuid,p_type text,p_quantity numeric,p_occurred_at timestamptz default now(),
 p_reference_no text default null,p_counterparty text default null,p_location text default null,p_notes text default null
) returns public.inventory_transactions language plpgsql security definer set search_path=public as $$
declare v_item public.boq_items%rowtype; v_balance numeric(18,4); v_result public.inventory_transactions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_user_role() not in ('admin','site_manager','storekeeper') then raise exception 'Insufficient role for inventory mutation'; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
 if p_type not in ('MASUK','KELUAR','PENYESUAIAN_MASUK','PENYESUAIAN_KELUAR') then raise exception 'Invalid transaction type'; end if;
 select * into v_item from public.boq_items where id=p_item_id and is_active=true for update;
 if not found then raise exception 'BOQ item not found or inactive'; end if;
 select coalesce(sum(case when transaction_type in ('MASUK','PENYESUAIAN_MASUK') then quantity else -quantity end),0)
 into v_balance from public.inventory_transactions where item_id=p_item_id;
 if p_type in ('KELUAR','PENYESUAIAN_KELUAR') and v_balance<p_quantity then
  raise exception 'Insufficient stock. Current balance: % %',v_balance,v_item.uom;
 end if;
 insert into public.inventory_transactions(idempotency_key,item_id,transaction_type,quantity,uom,occurred_at,reference_no,counterparty,location,notes,created_by)
 values(p_idempotency_key,p_item_id,p_type,p_quantity,v_item.uom,coalesce(p_occurred_at,now()),p_reference_no,p_counterparty,p_location,p_notes,auth.uid())
 on conflict(idempotency_key) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.inventory_transactions where idempotency_key=p_idempotency_key; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details)
 values(auth.uid(),'INVENTORY_MUTATION','inventory_transaction',v_result.id::text,
 jsonb_build_object('item_id',p_item_id,'type',p_type,'quantity',p_quantity,'uom',v_item.uom));
 return v_result;
end $$;
alter table public.profiles enable row level security;
alter table public.boq_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.cash_transactions enable row level security;
alter table public.documents enable row level security;
alter table public.audit_logs enable row level security;
create policy profiles_read_own_or_admin on public.profiles for select to authenticated using(id=auth.uid() or public.current_user_role()='admin');
create policy boq_items_read_authenticated on public.boq_items for select to authenticated using(true);
create policy boq_items_admin_write on public.boq_items for all to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
create policy inventory_read_authenticated on public.inventory_transactions for select to authenticated using(true);
create policy cash_read_authorized on public.cash_transactions for select to authenticated using(public.current_user_role() in ('admin','site_manager','finance','auditor'));
create policy documents_read_authenticated on public.documents for select to authenticated using(true);
create policy documents_write_authorized on public.documents for all to authenticated using(public.current_user_role() in ('admin','site_manager')) with check(public.current_user_role() in ('admin','site_manager'));
create policy audit_read_admin_auditor on public.audit_logs for select to authenticated using(public.current_user_role() in ('admin','auditor'));
revoke all on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) from public;
grant execute on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) to authenticated;
grant select on public.profiles,public.boq_items,public.inventory_transactions,public.cash_transactions,public.documents,public.audit_logs to authenticated;
