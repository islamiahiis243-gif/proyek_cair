export type BoqCsvImport = { sections: any[]; items: any[]; errors: string[] };

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      if (row.some(v => v.trim() !== '')) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(v => v.trim() !== '')) rows.push(row);
  return rows;
}

const cell = (v: any) => {
  const value = v == null ? '' : String(v);
  return /[",\r\n]/.test(value) ? '"' + value.replace(/"/g, '""') + '"' : value;
};

export function makeBoqCsv(sections: any[], items: any[]): string {
  const parentRow = new Map(sections.map(s => [s.id, s.source_row]));
  const header = ['row_type','level','parent_source_row','node_code','boq_code','description','quantity','uom','unit_rate','remarks','is_stock_item','source_excel_row','source_color','source_total_price','category'];
  const sectionRows = sections.map(s => ['SECTION',s.level,s.parent_id ? parentRow.get(s.parent_id) : '',s.node_code,'',s.description,s.source_qty,s.source_uom,'','','',s.source_row,s.source_color,s.source_total_price,'']);
  const itemRows = items.map(i => ['ITEM',4,parentRow.get(i.parent_section_id || '') || '', '',i.kode_boq,i.nama_barang,i.qty_boq,i.satuan,i.harga_satuan,i.keterangan || '',i.is_stock_item,i.source_excel_row ?? '', '', '',i.kategori || '']);
  return [header, ...sectionRows, ...itemRows].map(r => r.map(cell).join(',')).join('\r\n');
}

export function parseBoqCsv(text: string): BoqCsvImport {
  const rows = parseRows(text.replace(/^\uFEFF/, ''));
  if (rows.length < 2) return { sections: [], items: [], errors: ['File CSV kosong atau tidak memiliki baris data.'] };
  const headers = rows[0].map(v => v.trim().toLowerCase());
  const index = (key: string) => headers.indexOf(key);
  const required = ['row_type','level','parent_source_row','node_code','boq_code','description','quantity','uom','unit_rate','remarks','is_stock_item','source_excel_row','source_color','source_total_price','category'];
  const missing = required.filter(k => index(k) < 0);
  if (missing.length) return { sections: [], items: [], errors: ['Kolom wajib tidak ditemukan: ' + missing.join(', ')] };
  const value = (r: string[], key: string) => (r[index(key)] || '').trim();
  const number = (v: string) => v === '' ? null : Number(v.replace(/,/g, ''));
  const sections: any[] = [], items: any[] = [], errors: string[] = [];
  for (let n = 1; n < rows.length; n++) {
    const r = rows[n], type = value(r, 'row_type').toUpperCase();
    if (type === 'SECTION') {
      const source_row = Number(value(r, 'source_excel_row')), level = Number(value(r, 'level'));
      if (!source_row || ![1,2,3].includes(level) || !value(r, 'description')) { errors.push('Baris ' + (n + 1) + ': data kelompok tidak lengkap.'); continue; }
      sections.push({ source_row, node_code: value(r,'node_code'), description: value(r,'description'), level, parent_source_row: number(value(r,'parent_source_row')), sort_order: source_row, source_color: value(r,'source_color') || 'FFFFFF', source_qty: number(value(r,'quantity')), source_uom: value(r,'uom') || null, source_total_price: number(value(r,'source_total_price')) });
    } else if (type === 'ITEM') {
      const boq_code = value(r,'boq_code'), description = value(r,'description'), source_excel_row = Number(value(r,'source_excel_row'));
      if (!boq_code || !description || !source_excel_row) { errors.push('Baris ' + (n + 1) + ': kode, uraian, dan baris Excel wajib.'); continue; }
      const quantity = number(value(r,'quantity')), unit_rate = number(value(r,'unit_rate'));
      if ((value(r,'quantity') !== '' && quantity === null) || (value(r,'unit_rate') !== '' && unit_rate === null)) { errors.push('Baris ' + (n + 1) + ': Qty/harga bukan angka valid.'); continue; }
      items.push({ boq_code, description, quantity, uom: value(r,'uom') || null, unit_rate: unit_rate ?? 0, remarks: value(r,'remarks') || null, is_stock_item: value(r,'is_stock_item').toLowerCase() === 'true', source_excel_row, parent_source_row: number(value(r,'parent_source_row')), category: value(r,'category') || null });
    } else errors.push('Baris ' + (n + 1) + ': row_type harus SECTION atau ITEM.');
  }
  const codes = items.map(i => i.boq_code);
  if (new Set(codes).size !== codes.length) errors.push('Ada kode BOQ duplikat dalam file.');
  return { sections, items, errors };
}
