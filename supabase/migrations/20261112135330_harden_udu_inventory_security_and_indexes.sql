-- Tighten public RPC access, add FK indexes, and make stock mutation retries idempotent.
revoke all on function public.current_user_role() from public;
revoke all on function public.current_user_role() from anon;
revoke all on function public.current_user_role() from authenticated;
revoke all on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) from public;
revoke all on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) from anon;
grant execute on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) to authenticated;
create index if not exists inventory_transactions_created_by_idx on public.inventory_transactions(created_by);
create index if not exists cash_transactions_created_by_idx on public.cash_transactions(created_by);
create index if not exists documents_created_by_idx on public.documents(created_by);
create index if not exists audit_logs_actor_id_idx on public.audit_logs(actor_id);
drop policy if exists profiles_read_own_or_admin on public.profiles;
create policy profiles_read_own_or_admin on public.profiles for select to authenticated using(id=(select auth.uid()) or public.current_user_role()='admin');
drop policy if exists boq_items_admin_write on public.boq_items;
create policy boq_items_admin_insert on public.boq_items for insert to authenticated with check(public.current_user_role()='admin');
create policy boq_items_admin_update on public.boq_items for update to authenticated using(public.current_user_role()='admin') with check(public.current_user_role()='admin');
create policy boq_items_admin_delete on public.boq_items for delete to authenticated using(public.current_user_role()='admin');
drop policy if exists documents_write_authorized on public.documents;
create policy documents_insert_authorized on public.documents for insert to authenticated with check(public.current_user_role() in ('admin','site_manager'));
create policy documents_update_authorized on public.documents for update to authenticated using(public.current_user_role() in ('admin','site_manager')) with check(public.current_user_role() in ('admin','site_manager'));
create policy documents_delete_authorized on public.documents for delete to authenticated using(public.current_user_role() in ('admin','site_manager'));
create or replace function public.record_inventory_mutation(p_idempotency_key uuid,p_item_id uuid,p_type text,p_quantity numeric,p_occurred_at timestamptz default now(),p_reference_no text default null,p_counterparty text default null,p_location text default null,p_notes text default null) returns public.inventory_transactions language plpgsql security definer set search_path=public as $$
declare v_item public.boq_items%rowtype; v_balance numeric(18,4); v_result public.inventory_transactions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if public.current_user_role() not in ('admin','site_manager','storekeeper') then raise exception 'Insufficient role for inventory mutation'; end if;
 if p_idempotency_key is null then raise exception 'Idempotency key is required'; end if;
 select * into v_result from public.inventory_transactions where idempotency_key=p_idempotency_key;
 if found then return v_result; end if;
 if p_quantity is null or p_quantity<=0 then raise exception 'Quantity must be greater than zero'; end if;
 if p_type not in ('MASUK','KELUAR','PENYESUAIAN_MASUK','PENYESUAIAN_KELUAR') then raise exception 'Invalid transaction type'; end if;
 select * into v_item from public.boq_items where id=p_item_id and is_active=true for update;
 if not found then raise exception 'BOQ item not found or inactive'; end if;
 select coalesce(sum(case when transaction_type in ('MASUK','PENYESUAIAN_MASUK') then quantity else -quantity end),0) into v_balance from public.inventory_transactions where item_id=p_item_id;
 if p_type in ('KELUAR','PENYESUAIAN_KELUAR') and v_balance<p_quantity then raise exception 'Insufficient stock. Current balance: % %',v_balance,v_item.uom; end if;
 insert into public.inventory_transactions(idempotency_key,item_id,transaction_type,quantity,uom,occurred_at,reference_no,counterparty,location,notes,created_by)
 values(p_idempotency_key,p_item_id,p_type,p_quantity,v_item.uom,coalesce(p_occurred_at,now()),p_reference_no,p_counterparty,p_location,p_notes,auth.uid())
 on conflict(idempotency_key) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.inventory_transactions where idempotency_key=p_idempotency_key; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'INVENTORY_MUTATION','inventory_transaction',v_result.id::text,jsonb_build_object('item_id',p_item_id,'type',p_type,'quantity',p_quantity,'uom',v_item.uom));
 return v_result;
end $$;
