-- Ensure the hierarchy rollup view uses the querying user's table grants and RLS policies.
create or replace view public.boq_section_rollups with (security_invoker=true) as
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