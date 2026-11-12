-- Complete subgroup rows that are semantically Level 3 even though their source cells had no blue fill.
-- Preserve unquantified source rows as NULL rather than inventing quantities/UOMs.
begin;
alter table public.boq_items alter column quantity drop not null;
alter table public.boq_items alter column uom drop not null;
insert into public.boq_sections(source_sheet,source_row,node_code,description,level,parent_id,sort_order,source_color,source_qty,source_uom,source_total_price)
select 'Trainer & UDU Office',x.source_row,x.node_code,x.description,3,p.id,x.source_row,'000000',x.source_qty,x.source_uom,x.source_total_price
from (values
 (51,'D.2.1','Pemasangan Batako',50,84.13955::numeric,'m2'::text,18554874.26375::numeric),
 (55,'D.2.2','Pekerjaan Plesteran Dinding',50,168.2791::numeric,'m2'::text,4131251.905::numeric),
 (58,'D.2.3','Pekerjaan Acian Dinding',50,168.2791::numeric,'m2'::text,2301767.85::numeric),
 (61,'D.2.4','Pekerjaan Sloof & Ring Balok',50,1.4544::numeric,'m3'::text,4635176.373333333::numeric),
 (71,'D.2.5','Pekerjaan Kolom',50,0.891::numeric,'m3'::text,3411936.433333333::numeric),
 (160,'J.4.1','Sloof & Ring Balok',159,38.28::numeric,'m'::text,4008037.2::numeric),
 (170,'J.4.2','Kolom',159,0.729::numeric,'m3'::text,1790707::numeric)
) x(source_row,node_code,description,parent_source_row,source_qty,source_uom,source_total_price)
join public.boq_sections p on p.source_sheet='Trainer & UDU Office' and p.source_row=x.parent_source_row
on conflict(source_sheet,source_row) do update set node_code=excluded.node_code,description=excluded.description,level=3,parent_id=excluded.parent_id,source_qty=excluded.source_qty,source_uom=excluded.source_uom,source_total_price=excluded.source_total_price,updated_at=now();
update public.boq_items b set parent_section_id=(
 select s.id from public.boq_sections s where s.source_sheet=b.source_sheet and s.source_row < b.source_excel_row order by s.source_row desc limit 1
) where b.source_sheet='Trainer & UDU Office' and b.source_excel_row is not null;
insert into public.boq_items(boq_code,description,category,quantity,uom,unit_rate,remarks,source_sheet,source_row,source_excel_row,parent_section_id,is_active,is_stock_item,baseline_quantity,baseline_unit_rate)
values
 ('BOQ-R018','Batu Pondasi','I - MATERIAL PEKERJAAN SIPIL / B - PEKERJAAN BATU PONDASI',null,'m3',0,null,'Trainer & UDU Office',18,13,(select id from public.boq_sections where source_sheet='Trainer & UDU Office' and source_row=10),true,true,null,0),
 ('BOQ-R319','Reposisi unit kontainer','IV. B - Biaya Jasa Pembangunan',null,null,0,'By IMK','Trainer & UDU Office',319,314,(select id from public.boq_sections where source_sheet='Trainer & UDU Office' and source_row=309),true,false,null,0),
 ('BOQ-R320','Pengelasan dan restorasi badan kontainer (pekerjaan api)','IV. B - Biaya Jasa Pembangunan',null,null,0,'By IMK','Trainer & UDU Office',320,315,(select id from public.boq_sections where source_sheet='Trainer & UDU Office' and source_row=309),true,false,null,0),
 ('BOQ-R321','Pekerjaan dan material urukan','IV. B - Biaya Jasa Pembangunan',null,null,0,'By IMK','Trainer & UDU Office',321,316,(select id from public.boq_sections where source_sheet='Trainer & UDU Office' and source_row=309),true,false,null,0),
 ('BOQ-R322','Tempat tinggal/akomodasi','IV. B - Biaya Jasa Pembangunan',null,null,0,'By IMK','Trainer & UDU Office',322,317,(select id from public.boq_sections where source_sheet='Trainer & UDU Office' and source_row=309),true,false,null,0)
on conflict(boq_code) do update set description=excluded.description,category=excluded.category,quantity=excluded.quantity,uom=excluded.uom,unit_rate=excluded.unit_rate,remarks=excluded.remarks,source_row=excluded.source_row,source_excel_row=excluded.source_excel_row,parent_section_id=excluded.parent_section_id,baseline_quantity=excluded.baseline_quantity,baseline_unit_rate=excluded.baseline_unit_rate,updated_at=now();
commit;