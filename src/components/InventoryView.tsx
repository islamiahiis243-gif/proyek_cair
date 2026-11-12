import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ItemBarang, AvailabilityStatus } from '../types';
import {
  Search,
  Filter,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Package,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Building,
  Edit2,
  Trash2,
} from 'lucide-react';
import { formatRupiah, formatDateTime } from '../lib/pdfGenerator';

interface InventoryViewProps {
  onQuickMutate: (item: ItemBarang, type: 'MASUK' | 'KELUAR') => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ onQuickMutate }) => {
  const { items, addItem, updateItem, deleteItem } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemBarang | null>(null);

  // Form state for new / edit item
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('Sipil & Adukan');
  const [formUom, setFormUom] = useState('ea');
  const [formPrice, setFormPrice] = useState(0);
  const [formStock, setFormStock] = useState(0);
  const [formMinStock, setFormMinStock] = useState(5);
  const [formBoqNo, setFormBoqNo] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => set.add(it.kategori));
    return Array.from(set).sort();
  }, [items]);

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      const matchSearch =
        it.nama_barang.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.kode_boq.toLowerCase().includes(searchQuery.toLowerCase()) ||
        it.kategori.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedCategory === 'ALL' || it.kategori === selectedCategory;
      const matchStatus = selectedStatus === 'ALL' || it.status === selectedStatus;

      return matchSearch && matchCategory && matchStatus;
    });
  }, [items, searchQuery, selectedCategory, selectedStatus]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName('');
    setFormCategory('Sipil & Adukan');
    setFormUom('ea');
    setFormPrice(0);
    setFormStock(0);
    setFormMinStock(5);
    setFormBoqNo('');
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (item: ItemBarang) => {
    setEditingItem(item);
    setFormName(item.nama_barang);
    setFormCategory(item.kategori);
    setFormUom(item.satuan);
    setFormPrice(item.harga_satuan);
    setFormStock(item.stok_saat_ini);
    setFormMinStock(item.stok_minimum);
    setFormBoqNo(item.kode_boq);
    setIsAddModalOpen(true);
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingItem) {
      updateItem(editingItem.id, {
        nama_barang: formName.trim(),
        kategori: formCategory,
        satuan: formUom.trim(),
        harga_satuan: Number(formPrice),
        stok_saat_ini: Number(formStock),
        stok_minimum: Number(formMinStock),
        kode_boq: formBoqNo.trim() || editingItem.kode_boq,
      });
    } else {
      addItem({
        kode_boq: formBoqNo.trim() || String(items.length + 1),
        nama_barang: formName.trim(),
        kategori: formCategory,
        satuan: formUom.trim(),
        harga_satuan: Number(formPrice),
        stok_saat_ini: Number(formStock),
        stok_minimum: Number(formMinStock),
        keterangan: 'Item input manual',
      });
    }
    setIsAddModalOpen(false);
  };

  const renderStatusBadge = (status: AvailabilityStatus) => {
    if (status === 'Tersedia') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Tersedia
        </span>
      );
    }
    if (status === 'Stok Menipis') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Stok Menipis
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
        <XCircle className="w-3 h-3 text-rose-600" />
        Tidak Tersedia
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Katalog & Stok Fisik Barang
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Daftar master BOQ Kontraktor. Stok = 0 otomatis berstatus{' '}
            <strong className="text-rose-600 dark:text-rose-400">Tidak Tersedia</strong>. Seluruh item By IMK telah diabaikan.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Material Baru</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nama barang, no BOQ, atau kategori material..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Category Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kategori:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="ALL">Semua Kategori ({items.length})</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs text-slate-400 dark:text-slate-500 mr-1 font-medium">Filter Status:</span>
          {[
            { id: 'ALL', label: `Semua (${items.length})` },
            { id: 'Tersedia', label: `Tersedia (${items.filter((it) => it.status === 'Tersedia').length})` },
            { id: 'Stok Menipis', label: `Stok Menipis (${items.filter((it) => it.status === 'Stok Menipis').length})` },
            { id: 'Tidak Tersedia', label: `Tidak Tersedia (${items.filter((it) => it.status === 'Tidak Tersedia').length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedStatus === tab.id
                  ? 'bg-blue-600 text-white font-semibold shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-3.5 w-12 text-center">No</th>
                <th className="py-3 px-3.5">Nama Material / Uraian BOQ</th>
                <th className="py-3 px-3.5">Kategori</th>
                <th className="py-3 px-3.5 text-center">Satuan</th>
                <th className="py-3 px-3.5 text-right">Harga BOQ</th>
                <th className="py-3 px-3.5 text-right font-bold">Stok Saat Ini</th>
                <th className="py-3 px-3.5 text-center">Status</th>
                <th className="py-3 px-3.5 text-center">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    Tidak ada material yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const isZero = item.stok_saat_ini <= 0;
                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                        isZero ? 'bg-rose-50/20 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-3 px-3.5 text-center text-slate-400 dark:text-slate-500 font-mono text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-900 dark:text-white">{item.nama_barang}</div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          BOQ No: {item.kode_boq} {item.terakhir_mutasi && `· Mutasi: ${formatDateTime(item.terakhir_mutasi)}`}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-300">
                        <span className="text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                          {item.kategori}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center font-mono text-slate-700 dark:text-slate-300">
                        {item.satuan}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {formatRupiah(item.harga_satuan)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-bold tabular-nums">
                        <span
                          className={`text-sm ${
                            isZero ? 'text-rose-600 dark:text-rose-400' : item.stok_saat_ini <= item.stok_minimum ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {item.stok_saat_ini.toLocaleString('id-ID')}
                        </span>{' '}
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal">{item.satuan}</span>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {renderStatusBadge(item.status)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => onQuickMutate(item, 'MASUK')}
                            title="Tambah Stok Masuk"
                            className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded border border-emerald-200 dark:border-emerald-800 transition-colors"
                          >
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onQuickMutate(item, 'KELUAR')}
                            disabled={isZero}
                            title={isZero ? 'Stok habis, tidak bisa keluar' : 'Catat Stok Keluar'}
                            className={`p-1.5 rounded border transition-colors ${
                              isZero
                                ? 'text-slate-300 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50'
                                : 'text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            <ArrowUpRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEditModal(item)}
                            title="Ubah Rincian Item"
                            className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 transition-colors"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Menampilkan {filteredItems.length} dari total {items.length} item material</span>
          <span className="font-mono text-[11px]">BOQ Trainer & UDU Office Kontraktor</span>
        </div>
      </div>

      {/* Modal Add / Edit Item */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 transition-colors">
            <div className="p-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
              <div className="font-bold text-sm">
                {editingItem ? 'Ubah Rincian Material' : 'Tambah Material Baru ke Katalog'}
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Barang / Material <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Semen Portland 50kg, Hollow Gypsum 4x4..."
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Nomor BOQ</label>
                  <input
                    type="text"
                    placeholder="Contoh: 1, 42, B-12"
                    value={formBoqNo}
                    onChange={(e) => setFormBoqNo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Kategori</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg"
                  >
                    <option value="Sipil & Adukan">Sipil & Adukan</option>
                    <option value="Kayu & Plywood">Kayu & Plywood</option>
                    <option value="Besi & Struktur">Besi & Struktur</option>
                    <option value="Lantai & Keramik">Lantai & Keramik</option>
                    <option value="Plafond & Partisi">Plafond & Partisi</option>
                    <option value="Cat & Finishing">Cat & Finishing</option>
                    <option value="Kusen & Pintu">Kusen & Pintu</option>
                    <option value="Atap & Rangka">Atap & Rangka</option>
                    <option value="Plumbing & Sanitasi">Plumbing & Sanitasi</option>
                    <option value="Elektrikal & Panel">Elektrikal & Panel</option>
                    <option value="Fastener & Alat Bantu">Fastener & Alat Bantu</option>
                    <option value="Jasa & Tenaga Kerja">Jasa & Tenaga Kerja</option>
                    <option value="Material Umum">Material Umum</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Satuan (UOM)</label>
                  <input
                    type="text"
                    required
                    placeholder="m3, kg, zak, box, ea..."
                    value={formUom}
                    onChange={(e) => setFormUom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Harga Satuan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    value={formPrice}
                    onChange={(e) => setFormPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Ambang Stok Menipis</label>
                  <input
                    type="number"
                    min="1"
                    value={formMinStock}
                    onChange={(e) => setFormMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Stok Fisik Awal ({formUom})
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formStock}
                  onChange={(e) => setFormStock(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg font-mono"
                />
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {formStock <= 0
                    ? 'Stok = 0 akan otomatis menghasilkan status "Tidak Tersedia".'
                    : `Status otomatis: ${formStock <= formMinStock ? 'Stok Menipis' : 'Tersedia'}`}
                </p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Yakin ingin menghapus ${editingItem.nama_barang}?`)) {
                        deleteItem(editingItem.id);
                        setIsAddModalOpen(false);
                      }
                    }}
                    className="px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-800 transition-colors"
                  >
                    Hapus Item
                  </button>
                ) : (
                  <div></div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                  >
                    {editingItem ? 'Simpan Perubahan' : 'Simpan Material'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
