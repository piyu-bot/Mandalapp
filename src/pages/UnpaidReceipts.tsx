import { useEffect, useMemo, useState } from 'react';
import { supabase, type Receipt } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Search, CheckCircle2, Pencil, Eye, Trash2, Phone, Clock,
  ChevronLeft, ChevronRight, X,
} from '@/components/icons';

const PAGE_SIZE = 10;

export default function UnpaidReceipts() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [editReceipt, setEditReceipt] = useState<Receipt | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase.from('receipts').select('*').order('date', { ascending: false });
    if (error) { setError(true); }
    else { setReceipts(data as Receipt[]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = receipts;
    if (filter !== 'all') result = result.filter((r) => r.status === filter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((r) =>
        r.donor_name.toLowerCase().includes(q) ||
        r.receipt_number.toLowerCase().includes(q) ||
        (r.mobile ?? '').includes(q)
      );
    }
    return result;
  }, [receipts, filter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const markAsPaid = async (r: Receipt) => {
    const ok = await confirm({
      title: 'Mark as Paid',
      message: `Mark receipt ${r.receipt_number} (${formatCurrency(Number(r.amount))}) as fully paid?`,
      confirmText: 'Mark Paid',
    });
    if (!ok) return;
    const { error } = await supabase
      .from('receipts')
      .update({ status: 'Paid', paid_amount: r.amount })
      .eq('id', r.id);
    if (error) { toast('Failed to update receipt', 'error'); return; }
    await logAudit({
      action: 'Receipt Payment Updated',
      record_id: r.receipt_number,
      record_type: 'receipt',
      previous_value: { status: r.status, paid_amount: r.paid_amount } as Record<string, unknown>,
      new_value: { status: 'Paid', paid_amount: r.amount },
    });
    toast('Receipt marked as paid', 'success');
    load();
  };

  const handleDelete = async (r: Receipt) => {
    const ok = await confirm({
      title: 'Delete Receipt',
      message: `Delete receipt ${r.receipt_number}? This action cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('receipts').delete().eq('id', r.id);
    if (error) { toast('Failed to delete receipt', 'error'); return; }
    await logAudit({
      action: 'Receipt Deleted',
      record_id: r.receipt_number,
      record_type: 'receipt',
      previous_value: r as unknown as Record<string, unknown>,
    });
    toast('Receipt deleted', 'info');
    load();
  };

  const handleEditSave = async (updated: Partial<Receipt>) => {
    if (!editReceipt) return;
    const { error } = await supabase.from('receipts').update(updated).eq('id', editReceipt.id);
    if (error) { toast('Failed to update receipt', 'error'); return; }
    await logAudit({
      action: 'Receipt Edited',
      record_id: editReceipt.receipt_number,
      record_type: 'receipt',
      previous_value: editReceipt as unknown as Record<string, unknown>,
      new_value: updated as Record<string, unknown>,
    });
    toast('Receipt updated', 'success');
    setEditReceipt(null);
    load();
  };

  const filters = ['all', 'Pending', 'Partially Paid', 'Overdue', 'Paid'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Unpaid Receipts" subtitle="Track and manage pending collections" />
        <CardBody>
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search by name, receipt no, mobile..."
                className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setPage(1); }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${filter === f ? 'border-orange-500 bg-orange-500/15 text-orange-300' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}
                >
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message="Failed to load receipts." onRetry={load} />
        ) : paged.length === 0 ? (
          <EmptyState icon={<Clock className="h-7 w-7" />} title="No receipts found" message="No receipts match your current filter." />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-zinc-400">
                    <th className="px-5 py-3 font-medium">Receipt No</th>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Mobile</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Collected By</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paged.map((r) => (
                    <tr key={r.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{r.receipt_number}</td>
                      <td className="px-5 py-3 text-zinc-300">{r.donor_name}</td>
                      <td className="px-5 py-3 text-zinc-400">{r.mobile ?? '-'}</td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-white">{formatCurrency(Number(r.amount))}</span>
                        {r.status !== 'Paid' && Number(r.paid_amount) > 0 && (
                          <span className="block text-xs text-amber-400">Paid: {formatCurrency(Number(r.paid_amount))}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-zinc-400">{formatDate(r.date)}</td>
                      <td className="px-5 py-3 text-zinc-400">{r.collected_by ?? '-'}</td>
                      <td className="px-5 py-3"><Badge label={r.status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          {r.status !== 'Paid' && (
                            <button onClick={() => markAsPaid(r)} title="Mark as Paid" className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => setViewReceipt(r)} title="View" className="rounded-md p-1.5 text-sky-400 hover:bg-sky-500/10 transition-colors">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditReceipt(r)} title="Edit" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10 transition-colors">
                            <Pencil className="h-4 w-4" />
                          </button>
                          {r.mobile && (
                            <a href={`tel:${r.mobile}`} title="Contact" className="rounded-md p-1.5 text-violet-400 hover:bg-violet-500/10 transition-colors">
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          <button onClick={() => handleDelete(r)} title="Delete" className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 p-4 lg:hidden">
              {paged.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{r.receipt_number}</span>
                    <Badge label={r.status} />
                  </div>
                  <p className="mt-1 text-sm text-zinc-300">{r.donor_name}</p>
                  <p className="text-xs text-zinc-500">{r.mobile ?? '-'} · {formatDate(r.date)}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-semibold text-white">{formatCurrency(Number(r.amount))}</span>
                    <div className="flex gap-1">
                      {r.status !== 'Paid' && (
                        <button onClick={() => markAsPaid(r)} className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle2 className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => setViewReceipt(r)} className="rounded-md p-1.5 text-sky-400 hover:bg-sky-500/10"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => setEditReceipt(r)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(r)} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
                <span className="text-xs text-zinc-400">
                  Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 py-1.5 text-xs text-zinc-400">{page} / {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* View Modal */}
      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Receipt Details" size="md">
        {viewReceipt && (
          <div className="space-y-3">
            {[
              ['Receipt No', viewReceipt.receipt_number],
              ['Date', formatDate(viewReceipt.date)],
              ['Name', viewReceipt.donor_name],
              ['Mobile', viewReceipt.mobile ?? '-'],
              ['Address', viewReceipt.address ?? '-'],
              ['Amount', formatCurrency(Number(viewReceipt.amount))],
              ['Paid Amount', formatCurrency(Number(viewReceipt.paid_amount))],
              ['Payment Method', viewReceipt.payment_method],
              ['Purpose', viewReceipt.purpose ?? '-'],
              ['Collected By', viewReceipt.collected_by ?? '-'],
              ['Notes', viewReceipt.notes ?? '-'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-zinc-400">{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-sm text-zinc-400">Status</span>
              <Badge label={viewReceipt.status} />
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      {editReceipt && (
        <EditReceiptModal receipt={editReceipt} onClose={() => setEditReceipt(null)} onSave={handleEditSave} />
      )}
    </div>
  );
}

function EditReceiptModal({ receipt, onClose, onSave }: { receipt: Receipt; onClose: () => void; onSave: (data: Partial<Receipt>) => Promise<void> }) {
  const [form, setForm] = useState({
    donor_name: receipt.donor_name,
    mobile: receipt.mobile ?? '',
    address: receipt.address ?? '',
    amount: String(receipt.amount),
    paid_amount: String(receipt.paid_amount),
    payment_method: receipt.payment_method,
    purpose: receipt.purpose ?? '',
    collected_by: receipt.collected_by ?? '',
    notes: receipt.notes ?? '',
    status: receipt.status,
  });
  const [saving, setSaving] = useState(false);

  const field = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none';
  const labelClass = 'block text-sm font-medium text-zinc-300 mb-1';

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      donor_name: form.donor_name,
      mobile: form.mobile || null,
      address: form.address || null,
      amount: Number(form.amount),
      paid_amount: Number(form.paid_amount),
      payment_method: form.payment_method as Receipt['payment_method'],
      purpose: form.purpose || null,
      collected_by: form.collected_by || null,
      notes: form.notes || null,
      status: form.status as Receipt['status'],
    });
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${receipt.receipt_number}`} size="lg">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={labelClass}>Name</label><input value={form.donor_name} onChange={(e) => field('donor_name', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Mobile</label><input value={form.mobile} onChange={(e) => field('mobile', e.target.value)} className={inputClass} /></div>
        <div className="sm:col-span-2"><label className={labelClass}>Address</label><input value={form.address} onChange={(e) => field('address', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Amount</label><input type="number" step="0.01" value={form.amount} onChange={(e) => field('amount', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Paid Amount</label><input type="number" step="0.01" value={form.paid_amount} onChange={(e) => field('paid_amount', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Payment Method</label>
          <select value={form.payment_method} onChange={(e) => field('payment_method', e.target.value)} className={inputClass}>
            <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Other</option>
          </select>
        </div>
        <div><label className={labelClass}>Status</label>
          <select value={form.status} onChange={(e) => field('status', e.target.value)} className={inputClass}>
            <option>Paid</option><option>Pending</option><option>Partially Paid</option><option>Overdue</option>
          </select>
        </div>
        <div><label className={labelClass}>Purpose</label><input value={form.purpose} onChange={(e) => field('purpose', e.target.value)} className={inputClass} /></div>
        <div><label className={labelClass}>Collected By</label><input value={form.collected_by} onChange={(e) => field('collected_by', e.target.value)} className={inputClass} /></div>
        <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea value={form.notes} onChange={(e) => field('notes', e.target.value)} rows={2} className={inputClass} /></div>
      </div>
      <div className="mt-5 flex justify-end gap-3">
        <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white flex items-center gap-1"><X className="h-4 w-4" /> Cancel</button>
        <button onClick={handleSave} disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </Modal>
  );
}
