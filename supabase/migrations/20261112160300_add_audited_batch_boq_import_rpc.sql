-- Admin-only atomic batch import for the hierarchy-aware CSV template.
begin;
drop trigger if exists audit_boq_sections on public.boq_sections;
create trigger audit_boq_sections after insert or update or delete on public.boq_sections
for each row execute function public.capture_udu_audit();
create or replace function public.import_boq_master_batch(p_sections jsonb,p_items jsonb,p_reason text)
returns jsonb language plpgsql set search_path=public,auth as $$
declare v_sections integer:=0; v_items integer:=0;
begin
 if auth.uid() is null or public.current_user_role()<>'admin' then raise exception 'Hanya admin yang dapat mengimpor master BOQ.'; end if;
 if jsonb_typeof(p_sections)<>'array' or jsonb_typeof(p_items)<>'array' then raise exception 'Format import harus berupa array sections dan items.'; end if;
 if coalesce(length(trim(p_reason)),0)<8 then raise exception 'Alasan import minimal 8 karakter.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_sections) x(source_row int,node_code text,description text,level int,parent_source_row int,sort_order int,source_color text,source_qty numeric,source_uom text,source_total_price numeric) where source_row is null or description is null or level not between 1 and 3) then raise exception 'Baris kelompok BOQ tidak valid.'; end if;
 if exists(select 1 from jsonb_to_recordset(p_items) x(boq_code text,description text,quantity numeric,uom text,unit_rate numeric,remarks text,is_stock_item boolean,source_excel_row int,parent_source_row int,category text) where coalesce(trim(boq_code),'')='' or coalesce(trim(description),'')='' or source_excel_row is null) then raise exception 'Baris item BOQ tidak valid: kode, uraian, dan nomor baris Excel wajib.'; end if;
 insert into public.boq_sections(source_sheet,source_row,node_code,description,level,parent_id,sort_order,source_color,source_qty,source_uom,source_total_price,updated_by)
 select 'Trainer & UDU Office',x.source_row,x.node_code,x.description,x.level,null,coalesce(x.sort_order,x.source_row),coalesce(x.source_color,'FFFFFF'),x.source_qty,x.source_uom,x.source_total_price,auth.uid()
 from jsonb_to_recordset(p_sections) x(source_row int,node_code text,description text,level int,parent_source_row int,sort_order int,source_color text,source_qty numeric,source_uom text,source_total_price numeric)
 on conflict(source_sheet,source_row) do update set node_code=excluded.node_code,description=excluded.description,level=excluded.level,sort_order=excluded.sort_order,source_color=excluded.source_color,source_qty=excluded.source_qty,source_uom=excluded.source_uom,source_total_price=excluded.source_total_price,updated_by=auth.uid(),updated_at=now();
 get diagnostics v_sections=row_count;
 update public.boq_sections child set parent_id=parent.id,updated_by=auth.uid(),updated_at=now()
 from jsonb_to_recordset(p_sections) x(source_row int,parent_source_row int)
 left join public.boq_sections parent on parent.source_sheet='Trainer & UDU Office' and parent.source_row=x.parent_source_row
 where child.source_sheet='Trainer & UDU Office' and child.source_row=x.source_row and child.parent_id is distinct from parent.id;
 insert into public.boq_items(boq_code,description,category,quantity,uom,unit_rate,remarks,source_sheet,source_row,source_excel_row,parent_section_id,is_active,is_stock_item,baseline_quantity,baseline_unit_rate)
 select x.boq_code,x.description,x.category,x.quantity,x.uom,coalesce(x.unit_rate,0),x.remarks,'Trainer & UDU Office',x.source_excel_row+5,x.source_excel_row,s.id,true,coalesce(x.is_stock_item,true),x.quantity,coalesce(x.unit_rate,0)
 from jsonb_to_recordset(p_items) x(boq_code text,description text,quantity numeric,uom text,unit_rate numeric,remarks text,is_stock_item boolean,source_excel_row int,parent_source_row int,category text)
 left join public.boq_sections s on s.source_sheet='Trainer & UDU Office' and s.source_row=x.parent_source_row
 on conflict(boq_code) do update set description=excluded.description,category=excluded.category,quantity=excluded.quantity,uom=excluded.uom,unit_rate=excluded.unit_rate,remarks=excluded.remarks,source_row=excluded.source_row,source_excel_row=excluded.source_excel_row,parent_section_id=excluded.parent_section_id,is_active=true,is_stock_item=excluded.is_stock_item,baseline_quantity=excluded.baseline_quantity,baseline_unit_rate=excluded.baseline_unit_rate,updated_at=now();
 get diagnostics v_items=row_count;
 insert into public.audit_logs(actor_id,action,entity_type,entity_id,details) values(auth.uid(),'BOQ_BATCH_IMPORT','boq_master',null,jsonb_build_object('reason',p_reason,'sections_affected',v_sections,'items_affected',v_items));
 return jsonb_build_object('success',true,'sections_affected',v_sections,'items_affected',v_items);
end; $$;
revoke all on function public.import_boq_master_batch(jsonb,jsonb,text) from public,anon;
grant execute on function public.import_boq_master_batch(jsonb,jsonb,text) to authenticated;
commit;