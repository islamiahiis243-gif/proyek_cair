-- Link section parentage after all section rows exist; attach item rows using the original workbook row.
begin;
update public.boq_sections child set parent_id=parent.id,updated_at=now()
from public.boq_sections parent
where child.source_sheet=parent.source_sheet and child.parent_id is null
and child.source_row in (3,10,15,16,27,35,36,50,81,97,107,108,118,129,138,139,150,155,159,180,186,192,207,221,234,241,292)
and parent.source_row=case child.source_row
 when 3 then 2 when 10 then 2 when 15 then 2 when 16 then 15 when 27 then 15
 when 35 then 2 when 36 then 35 when 50 then 35 when 81 then 2 when 97 then 2
 when 107 then 2 when 108 then 107 when 118 then 107 when 129 then 2 when 138 then 2
 when 139 then 138 when 150 then 138 when 155 then 138 when 159 then 138 when 180 then 138
 when 186 then 2 when 192 then 191 when 207 then 191 when 221 then 191 when 234 then 191
 when 241 then 240 when 292 then 240 end;
update public.boq_items b set parent_section_id=(
 select s.id from public.boq_sections s where s.source_sheet=b.source_sheet and s.source_row < b.source_excel_row
 order by s.source_row desc limit 1
) where b.source_sheet='Trainer & UDU Office' and b.source_excel_row is not null;
create or replace view public.boq_section_rollups as
with recursive descendants(root_id,descendant_id) as (
 select id,id from public.boq_sections where is_active
 union all select d.root_id,c.id from descendants d join public.boq_sections c on c.parent_id=d.descendant_id and c.is_active
), item_totals as (
 select d.root_id,coalesce(sum(b.quantity*b.unit_rate),0)::numeric calculated_total_price,count(distinct b.id)::integer item_count
 from descendants d join public.boq_items b on b.parent_section_id=d.descendant_id and b.is_active group by d.root_id
), qty_totals as (
 select root_id,coalesce(jsonb_object_agg(uom,qty),'{}'::jsonb) quantities_by_uom
 from (select d.root_id,b.uom,sum(b.quantity)::numeric qty from descendants d join public.boq_items b on b.parent_section_id=d.descendant_id and b.is_active group by d.root_id,b.uom) q
 group by root_id
)
select s.id,s.source_sheet,s.source_row,s.node_code,s.description,s.level,s.parent_id,s.sort_order,s.source_color,s.source_qty,s.source_uom,s.source_total_price,
 coalesce(t.calculated_total_price,0) calculated_total_price,coalesce(q.quantities_by_uom,'{}'::jsonb) quantities_by_uom,coalesce(t.item_count,0) item_count,
 coalesce(t.calculated_total_price,0)-coalesce(s.source_total_price,0) source_total_variance
from public.boq_sections s left join item_totals t on t.root_id=s.id left join qty_totals q on q.root_id=s.id where s.is_active;
commit;