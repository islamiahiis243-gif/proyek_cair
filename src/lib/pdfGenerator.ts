import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { DokumenLaporan, ItemBarang, MutasiBarang, MutasiKas, UserProfile } from '../types';

function stableStringify(value:any):string {
  if(Array.isArray(value)) return '['+value.map(stableStringify).join(',')+']';
  if(value&&typeof value==='object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
async function sha256Hex(value:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDateTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

export function formatDateOnly(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

/**
 * Generate PDF for Stock Mutation Report
 */
export async function generateStockMutationPDF(params: {
  docId: string;
  startDate: string;
  endDate: string;
  mutations: MutasiBarang[];
  signer: UserProfile;
}): Promise<DokumenLaporan> {
  const { docId, startDate, endDate, mutations, signer } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Verification URL
  const verifyUrl = `${window.location.origin}/?verify_doc=${encodeURIComponent(docId)}&type=stock`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 250,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  // Calculate stats
  const totalMasuk = mutations.filter((m) => m.jenis === 'MASUK').reduce((acc, m) => acc + m.jumlah, 0);
  const totalKeluar = mutations.filter((m) => m.jenis === 'KELUAR').reduce((acc, m) => acc + m.jumlah, 0);
  const snapshot = stableStringify({document_type:'MUTASI_STOK',period_start:startDate,period_end:endDate,transactions:mutations.map(m=>({id:m.id,barang_id:m.barang_id,jenis:m.jenis,jumlah:m.jumlah,satuan:m.satuan,tujuan:m.tujuan_keperluan,pic:m.pic_penerima_penyerah,reference:m.nomor_surat_jalan||null,tanggal:m.tanggal,catatan:m.catatan||null}))});
  const hash = await sha256Hex(snapshot);

  // Header Bar
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PROYEK CAIR', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Sistem Mutasi Stok & Kas Lapangan Real-Time | Trainer & UDU Office', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('LAPORAN OPERASIONAL', pageWidth - 14, 15, { align: 'right' });

  // Document Title & Metadata Box
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BERITA ACARA MUTASI KELUAR / MASUK BARANG', 14, 34);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Nomor Registrasi : ${docId}`, 14, 41);
  doc.text(`Periode Laporan  : ${formatDateOnly(startDate)} s/d ${formatDateOnly(endDate)}`, 14, 46);
  doc.text(`Tanggal Cetak    : ${formatDateOnly(new Date().toISOString())}`, 14, 51);

  doc.text(`Proyek       : Trainer & UDU Office (BOQ Kontraktor)`, pageWidth - 14, 41, { align: 'right' });
  doc.text(`Penanggung   : ${signer.name} (${signer.databaseRole || signer.role})`, pageWidth - 14, 46, { align: 'right' });
  doc.text(`Email PIC    : ${signer.email}`, pageWidth - 14, 51, { align: 'right' });

  // KPI Summary Strip
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(14, 56, pageWidth - 28, 16, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL TRANSAKSI', 20, 62);
  doc.text('TOTAL ITEM MASUK', 75, 62);
  doc.text('TOTAL ITEM KELUAR', 130, 62);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${mutations.length} Transaksi`, 20, 68);

  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(`+ ${totalMasuk.toLocaleString('id-ID')} unit`, 75, 68);

  doc.setTextColor(159, 18, 57); // rose-800
  doc.text(`- ${totalKeluar.toLocaleString('id-ID')} unit`, 130, 68);

  // Table
  const tableData = mutations.map((m, index) => [
    (index + 1).toString(),
    formatDateTime(m.tanggal),
    m.nama_barang,
    m.jenis,
    `${m.jumlah} ${m.satuan}`,
    m.tujuan_keperluan,
    m.pic_penerima_penyerah,
    m.nomor_surat_jalan || '-',
  ]);

  autoTable(doc, {
    startY: 77,
    head: [['No', 'Waktu', 'Nama Material / Barang', 'Jenis', 'Volume', 'Peruntukan / Lokasi', 'PIC', 'Ref / Bon']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 26 },
      2: { fontStyle: 'bold', cellWidth: 42 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      5: { cellWidth: 36 },
      6: { cellWidth: 22 },
      7: { cellWidth: 16, halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw === 'MASUK') {
          data.cell.styles.textColor = [22, 101, 52];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [159, 18, 57];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // End of table Y position
  const finalY = (doc as any).lastAutoTable.finalY || 160;
  let signY = finalY + 12;

  // Add new page if space is insufficient for signatures & QR
  if (signY + 45 > pageHeight) {
    doc.addPage();
    signY = 25;
  }

  // Signature Block & QR Code
  doc.setDrawColor(226, 232, 240);
  doc.line(14, signY, pageWidth - 14, signY);

  signY += 6;

  // Left column: PIC Signature
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Disusun Oleh,', 14, signY);
  doc.text(signer.databaseRole || signer.role, 14, signY + 4);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(signer.name, 14, signY + 28);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`ID Akun: ${signer.email}`, 14, signY + 32);

  // Center column: Checker
  doc.text('Persetujuan Digital', 80, signY);
  doc.text('Belum dicatat / belum disahkan', 80, signY + 4);

  // Right column: Digital QR Code Verification Box
  const qrBoxX = pageWidth - 60;
  const qrSize = 26;
  doc.addImage(qrDataUrl, 'PNG', qrBoxX + 16, signY - 2, qrSize, qrSize);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199); // sky-600
  doc.text('QR REGISTRASI DATA', qrBoxX + 16 + qrSize / 2, signY + 28, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Scan QR untuk validasi', qrBoxX + 16 + qrSize / 2, signY + 32, { align: 'center' });

  // Security Checksum Hash footer
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `SHA-256 snapshot transaksi (bukan tanda tangan digital): ${hash}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  // Save PDF
  doc.save(`${docId}_Mutasi_Barang_Proyek_Cair.pdf`);

  return {
    id: docId,
    judul: 'Laporan Mutasi Keluar/Masuk Barang',
    jenis: 'MUTASI_STOK',
    periode_awal: startDate,
    periode_akhir: endDate,
    dibuat_pada: new Date().toISOString(),
    penandatangan_nama: signer.name,
    penandatangan_jabatan: signer.role,
    penandatangan_email: signer.email,
    hash_keamanan: hash,
    total_transaksi: mutations.length,
    ringkasan_nilai_rp: 0,
    qr_payload: verifyUrl,
    snapshot_json: snapshot,
  };
}

/**
 * Generate PDF for Cashflow Ledger Report
 */
export async function generateCashflowPDF(params: {
  docId: string;
  startDate: string;
  endDate: string;
  cashMutations: MutasiKas[];
  signer: UserProfile;
}): Promise<DokumenLaporan> {
  const { docId, startDate, endDate, cashMutations, signer } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const verifyUrl = `${window.location.origin}/?verify_doc=${encodeURIComponent(docId)}&type=cash`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    margin: 1,
    width: 250,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  // Calculate cash totals
  const totalIn = cashMutations.filter((m) => m.jenis === 'MASUK').reduce((acc, m) => acc + m.jumlah_rp, 0);
  const totalOut = cashMutations.filter((m) => m.jenis === 'KELUAR').reduce((acc, m) => acc + m.jumlah_rp, 0);
  const latestSaldo = cashMutations.length > 0 ? cashMutations[cashMutations.length - 1].saldo_setelah : totalIn - totalOut;
  const snapshot = JSON.stringify({document_type:'MUTASI_KAS',period_start:startDate,period_end:endDate,transactions:cashMutations.map(m=>({id:m.id,jenis:m.jenis,jumlah_rp:m.jumlah_rp,untuk_apa:m.untuk_apa,kategori:m.kategori_keperluan,pic:m.pic,reference:m.nomor_kuitansi||null,tanggal:m.tanggal,saldo_setelah:m.saldo_setelah,catatan:m.catatan||null}))});
  const hash = await sha256Hex(snapshot);

  // Header Bar
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 24, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text('PROYEK CAIR', 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Buku Mutasi Keuangan & Arus Kas Lapangan | Trainer & UDU Office', 14, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text('LAPORAN OPERASIONAL', pageWidth - 14, 15, { align: 'right' });

  // Document Title & Metadata Box
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('LAPORAN MUTASI KEUANGAN & KAS PROYEK', 14, 34);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  doc.text(`Nomor Registrasi : ${docId}`, 14, 41);
  doc.text(`Periode Kas      : ${formatDateOnly(startDate)} s/d ${formatDateOnly(endDate)}`, 14, 46);
  doc.text(`Tanggal Cetak    : ${formatDateOnly(new Date().toISOString())}`, 14, 51);

  doc.text(`Status Dokumen : DRAFT / BELUM DISAHKAN`, pageWidth - 14, 41, { align: 'right' });
  doc.text(`Penanggung Kas  : ${signer.name} (${signer.role})`, pageWidth - 14, 46, { align: 'right' });
  doc.text(`Email PIC       : ${signer.email}`, pageWidth - 14, 51, { align: 'right' });

  // KPI Summary Strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 56, pageWidth - 28, 18, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL KAS MASUK (IN)', 20, 62);
  doc.text('TOTAL KAS KELUAR (OUT)', 80, 62);
  doc.text('SISA SALDO KAS BERJALAN', 135, 62);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 101, 52); // emerald-800
  doc.text(formatRupiah(totalIn), 20, 70);

  doc.setTextColor(159, 18, 57); // rose-800
  doc.text(formatRupiah(totalOut), 80, 70);

  doc.setTextColor(3, 105, 161); // sky-700
  doc.text(formatRupiah(latestSaldo), 135, 70);

  // Cash table: In / Out / Untuk Apa / Saldo
  const tableData = cashMutations.map((c, index) => [
    (index + 1).toString(),
    formatDateTime(c.tanggal),
    c.jenis,
    c.untuk_apa,
    c.kategori_keperluan,
    c.pic,
    c.jenis === 'MASUK' ? formatRupiah(c.jumlah_rp) : '-',
    c.jenis === 'KELUAR' ? formatRupiah(c.jumlah_rp) : '-',
    formatRupiah(c.saldo_setelah),
  ]);

  autoTable(doc, {
    startY: 80,
    head: [['No', 'Waktu', 'Jenis', 'Peruntukan / Untuk Apa', 'Kategori', 'PIC', 'Masuk (Rp)', 'Keluar (Rp)', 'Saldo (Rp)']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7,
      textColor: [30, 41, 59],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { halign: 'center', cellWidth: 14 },
      3: { cellWidth: 46, fontStyle: 'bold' },
      4: { cellWidth: 22 },
      5: { cellWidth: 18 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 2) {
          if (data.cell.raw === 'MASUK') {
            data.cell.styles.textColor = [22, 101, 52];
            data.cell.styles.fontStyle = 'bold';
          } else {
            data.cell.styles.textColor = [159, 18, 57];
            data.cell.styles.fontStyle = 'bold';
          }
        }
        if (data.column.index === 6 && data.cell.raw !== '-') {
          data.cell.styles.textColor = [22, 101, 52];
        }
        if (data.column.index === 7 && data.cell.raw !== '-') {
          data.cell.styles.textColor = [159, 18, 57];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 160;
  let signY = finalY + 12;

  if (signY + 45 > pageHeight) {
    doc.addPage();
    signY = 25;
  }

  // Signature and QR verification
  doc.setDrawColor(226, 232, 240);
  doc.line(14, signY, pageWidth - 14, signY);
  signY += 6;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text('Disusun Oleh,', 14, signY);
  doc.text(signer.role, 14, signY + 4);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(signer.name, 14, signY + 28);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`ID Akun: ${signer.email}`, 14, signY + 32);

  doc.text('Persetujuan Digital', 80, signY);
  doc.text('Belum dicatat / belum disahkan', 80, signY + 4);

  const qrBoxX = pageWidth - 60;
  const qrSize = 26;
  doc.addImage(qrDataUrl, 'PNG', qrBoxX + 16, signY - 2, qrSize, qrSize);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(2, 132, 199);
  doc.text('QR REGISTRASI DATA', qrBoxX + 16 + qrSize / 2, signY + 28, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Scan QR untuk validasi kas', qrBoxX + 16 + qrSize / 2, signY + 32, { align: 'center' });

  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `SHA-256 snapshot transaksi (bukan tanda tangan digital): ${hash}`,
    pageWidth / 2,
    pageHeight - 6,
    { align: 'center' }
  );

  doc.save(`${docId}_Buku_Kas_Proyek_Cair.pdf`);

  return {
    id: docId,
    judul: 'Laporan Mutasi Keuangan & Kas Proyek',
    jenis: 'MUTASI_KAS',
    periode_awal: startDate,
    periode_akhir: endDate,
    dibuat_pada: new Date().toISOString(),
    penandatangan_nama: signer.name,
    penandatangan_jabatan: signer.role,
    penandatangan_email: signer.email,
    hash_keamanan: hash,
    total_transaksi: cashMutations.length,
    ringkasan_nilai_rp: latestSaldo,
    qr_payload: verifyUrl,
    snapshot_json: snapshot,
  };
}
