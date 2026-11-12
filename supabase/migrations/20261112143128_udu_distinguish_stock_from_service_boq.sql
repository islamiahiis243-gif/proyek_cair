-- Distinguish material stock lines from service/non-stock BOQ lines.
alter table public.boq_items add column if not exists is_stock_item boolean not null default true;
update public.boq_items set is_stock_item=(category not ilike 'IV.%') where source_sheet='Trainer & UDU Office';
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
 select * into v_item from public.boq_items where id=p_item_id and is_active=true and is_stock_item=true for update;
 if not found then raise exception 'BOQ item is not a stock-controlled material'; end if;
 select coalesce(sum(case when transaction_type in ('MASUK','PENYESUAIAN_MASUK') then quantity else -quantity end),0) into v_balance from public.inventory_transactions where item_id=p_item_id;
 if p_type in ('KELUAR','PENYESUAIAN_KELUAR') and v_balance<p_quantity then raise exception 'Insufficient stock. Current balance: % %',v_balance,v_item.uom; end if;
 insert into public.inventory_transactions(idempotency_key,item_id,transaction_type,quantity,uom,occurred_at,reference_no,counterparty,location,notes,created_by)
 values(p_idempotency_key,p_item_id,p_type,p_quantity,v_item.uom,coalesce(p_occurred_at,now()),p_reference_no,p_counterparty,p_location,p_notes,auth.uid())
 on conflict(idempotency_key) do nothing returning * into v_result;
 if v_result.id is null then select * into v_result from public.inventory_transactions where idempotency_key=p_idempotency_key; end if;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'INVENTORY_MUTATION','inventory_transaction',v_result.id::text,jsonb_build_object('item_id',p_item_id,'type',p_type,'quantity',p_quantity,'uom',v_item.uom));
 return v_result;
end $$;
revoke all on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) from public,anon;
grant execute on function public.record_inventory_mutation(uuid,uuid,text,numeric,timestamptz,text,text,text,text) to authenticated;
