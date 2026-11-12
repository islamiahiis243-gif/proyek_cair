-- UDU real cash ledger and persisted report metadata.
alter table public.cash_transactions add column if not exists pic text;
alter table public.cash_transactions add column if not exists notes text;
alter table public.documents add column if not exists period_start date;
alter table public.documents add column if not exists period_end date;
alter table public.documents add column if not exists signer_name text;
alter table public.documents add column if not exists signer_role text;
alter table public.documents add column if not exists signer_email text;
alter table public.documents add column if not exists total_transactions integer not null default 0;
alter table public.documents add column if not exists amount_summary numeric(18,2) not null default 0;
alter table public.documents add column if not exists qr_payload text;
create or replace function public.record_cash_mutation(p_idempotency_key uuid,p_type text,p_amount numeric,p_occurred_at timestamptz default now(),p_category text default null,p_description text default null,p_reference_no text default null,p_pic text default null,p_notes text default null) returns public.cash_transactions language plpgsql security definer set search_path=public as $$
declare v_balance numeric(18,2); v_result public.cash_transactions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_user_role() not in ('admin','site_manager','finance') then raise exception 'Insufficient role for cash mutation'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_result from public.cash_transactions where idempotency_key=p_idempotency_key;
 if found then return v_result; end if;
 if p_type not in ('MASUK','KELUAR') then raise exception 'Invalid cash transaction type'; end if;
 if p_amount is null or p_amount<=0 then raise exception 'Amount must be greater than zero'; end if;
 if coalesce(trim(p_description),'')='' then raise exception 'Description is required'; end if;
 select coalesce(sum(case when transaction_type='MASUK' then amount else -amount end),0) into v_balance from public.cash_transactions;
 if p_type='KELUAR' and v_balance<p_amount then raise exception 'Insufficient cash balance: %',v_balance; end if;
 insert into public.cash_transactions(idempotency_key,transaction_type,amount,occurred_at,category,description,reference_no,pic,notes,created_by)
 values(p_idempotency_key,p_type,p_amount,coalesce(p_occurred_at,now()),p_category,p_description,p_reference_no,p_pic,p_notes,auth.uid())
 on conflict(idempotency_key) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.cash_transactions where idempotency_key=p_idempotency_key; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'CASH_MUTATION','cash_transaction',v_result.id::text,jsonb_build_object('type',p_type,'amount',p_amount,'category',p_category));
 return v_result;
end $$;
revoke all on function public.record_cash_mutation(uuid,text,numeric,timestamptz,text,text,text,text,text) from public,anon;
grant execute on function public.record_cash_mutation(uuid,text,numeric,timestamptz,text,text,text,text,text) to authenticated;
