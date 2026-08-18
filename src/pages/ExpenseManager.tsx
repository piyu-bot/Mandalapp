import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase, type Expense } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { formatCurrency, formatDate, generateExpenseId, todayISO } from '@/lib/utils';
import {
  Search, Plus, Trash2, Pencil, Eye, Wallet, Upload,
  ChevronLeft, ChevronRight, X, Loader2, Filter,
} from '@/components/icons';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const CATEGORIES = ['Mandap', 'Decoration', 'Lighting', 'Sound System', 'Electricity', 'Prasad', 'Pooja Material', 'Advertisement', 'Cultural Program', 'Security', 'Cleaning', 'Other'];

const PIE_COLORS = ['#f97316', '#eab308', '#22c55e', '#06b6d4', '#8b5cf6', '#ec4899', '#ef4444', '#14b8a6', '#f59e0b', '#3b82f6', '#a855f7', '#64748b'];
const PAGE_SIZE = 10;

export default function ExpenseManager() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [editExpense, setEditExpense] = useState<Expense | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase.from('expenses').select('*').order('date', { ascending: false });
    if (error) { setError(true); }
    else { setExpenses(data as Expense[]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = expenses;
    if (catFilter !== 'all') result = result.filter((e) => e.category === catFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.description.toLowerCase().includes(q) ||
        e.expense_id.toLowerCase().includes(q) ||
        (e.paid_to ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [expenses, search, catFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalAmount = expenses.reduce((s, e) => s + Number(e.amount), 0);

  // Category chart data
  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const handleDelete = async (e: Expense) => {
    const ok = await confirm({
      title: 'Delete Expense',
      message: `Delete expense "${e.description}" (${formatCurrency(Number(e.amount))})? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('expenses').delete().eq('id', e.id);
    if (error) { toast('Failed to delete expense', 'error'); return; }
    await logAudit({
      action: 'Expense Deleted',
      record_id: e.expense_id,
      record_type: 'expense',
      previous_value: e as unknown as Record<string, unknown>,
    });
    toast('Expense deleted', 'info');
    load();
  };

  const handleEditSave = async (updated: Partial<Expense>) => {
    if (!editExpense) return;
    const { error } = await supabase.from('expenses').update(updated).eq('id', editExpense.id);
    if (error) { toast('Failed to update expense', 'error'); return; }
    await logAudit({
      action: 'Expense Edited',
      record_id: editExpense.expense_id,
      record_type: 'expense',
      previous_value: editExpense as unknown as Record<string, unknown>,
      new_value: updated as Record<string, unknown>,
    });
    toast('Expense updated', 'success');
    setEditExpense(null);
    load();
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardBody className="p-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Wallet className="h-4 w-4 text-orange-400" /> Total Expenses</div><p className="mt-2 text-xl font-bold text-white">{loading ? '...' : formatCurrency(totalAmount)}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Filter className="h-4 w-4 text-sky-400" /> Categories</div><p className="mt-2 text-xl font-bold text-white">{loading ? '...' : String(chartData.length)}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Wallet className="h-4 w-4 text-emerald-400" /> This Month</div><p className="mt-2 text-xl font-bold text-white">{loading ? '...' : formatCurrency(expenses.filter((e) => { const d = new Date(e.date); const n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).reduce((s, e) => s + Number(e.amount), 0))}</p></CardBody></Card>
        <Card><CardBody className="p-4"><div className="flex items-center gap-2 text-xs text-zinc-400"><Wallet className="h-4 w-4 text-violet-400" /> Total Records</div><p className="mt-2 text-xl font-bold text-white">{loading ? '...' : String(expenses.length)}</p></CardBody></Card>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader title="Expense by Category" subtitle="Distribution of spending" />
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={(entry) => entry.name}>
                  {chartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff20', borderRadius: '12px', color: '#fff' }} formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader
          title="All Expenses"
          subtitle="Manage festival spending"
          action={
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-500 hover:to-amber-500 transition-all">
              <Plus className="h-4 w-4" /> Add Expense
            </button>
          }
        />
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search expenses..." className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none" />
            </div>
            <select value={catFilter} onChange={(e) => { setCatFilter(e.target.value); setPage(1); }} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-orange-500/50 focus:outline-none">
              <option value="all">All Categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </CardBody>

        {loading ? (
          <TableSkeleton rows={6} />
        ) : error ? (
          <ErrorState message="Failed to load expenses." onRetry={load} />
        ) : paged.length === 0 ? (
          <EmptyState icon={<Wallet className="h-7 w-7" />} title="No expenses found" message="Add an expense to get started." action={<button onClick={() => setShowForm(true)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500">Add Expense</button>} />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-zinc-400">
                    <th className="px-5 py-3 font-medium">Expense ID</th>
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Category</th>
                    <th className="px-5 py-3 font-medium">Description</th>
                    <th className="px-5 py-3 font-medium">Amount</th>
                    <th className="px-5 py-3 font-medium">Paid To</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paged.map((e) => (
                    <tr key={e.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 font-medium text-white">{e.expense_id}</td>
                      <td className="px-5 py-3 text-zinc-400">{formatDate(e.date)}</td>
                      <td className="px-5 py-3"><Badge label={e.category} /></td>
                      <td className="px-5 py-3 text-zinc-300 max-w-xs truncate">{e.description}</td>
                      <td className="px-5 py-3 font-semibold text-red-400">{formatCurrency(Number(e.amount))}</td>
                      <td className="px-5 py-3 text-zinc-400">{e.paid_to ?? '-'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewExpense(e)} title="View" className="rounded-md p-1.5 text-sky-400 hover:bg-sky-500/10"><Eye className="h-4 w-4" /></button>
                          <button onClick={() => setEditExpense(e)} title="Edit" className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                          {e.bill_url && <a href={e.bill_url} target="_blank" rel="noreferrer" title="View Bill" className="rounded-md p-1.5 text-violet-400 hover:bg-violet-500/10"><Upload className="h-4 w-4" /></a>}
                          <button onClick={() => handleDelete(e)} title="Delete" className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 p-4 lg:hidden">
              {paged.map((e) => (
                <div key={e.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between"><span className="font-medium text-white text-sm">{e.expense_id}</span><Badge label={e.category} /></div>
                  <p className="mt-1 text-sm text-zinc-300">{e.description}</p>
                  <p className="text-xs text-zinc-500">{formatDate(e.date)} · {e.paid_to ?? '-'}</p>
                  <div className="mt-2 flex items-center justify-between"><span className="font-semibold text-red-400">{formatCurrency(Number(e.amount))}</span>
                    <div className="flex gap-1">
                      <button onClick={() => setViewExpense(e)} className="rounded-md p-1.5 text-sky-400 hover:bg-sky-500/10"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => setEditExpense(e)} className="rounded-md p-1.5 text-zinc-400 hover:bg-white/10"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => handleDelete(e)} className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
                <span className="text-xs text-zinc-400">Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                  <span className="px-3 py-1.5 text-xs text-zinc-400">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-white/10 p-1.5 text-zinc-400 hover:text-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Add Form Modal */}
      {showForm && <ExpenseForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}

      {/* View Modal */}
      <Modal open={!!viewExpense} onClose={() => setViewExpense(null)} title="Expense Details" size="md">
        {viewExpense && (
          <div className="space-y-3">
            {[
              ['Expense ID', viewExpense.expense_id],
              ['Date', formatDate(viewExpense.date)],
              ['Category', viewExpense.category],
              ['Description', viewExpense.description],
              ['Amount', formatCurrency(Number(viewExpense.amount))],
              ['Payment Method', viewExpense.payment_method],
              ['Paid To', viewExpense.paid_to ?? '-'],
              ['Added By', viewExpense.added_by ?? '-'],
              ['Notes', viewExpense.notes ?? '-'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-zinc-400">{label}</span>
                <span className="text-sm font-medium text-white">{value}</span>
              </div>
            ))}
            {viewExpense.bill_url && <a href={viewExpense.bill_url} target="_blank" rel="noreferrer" className="block text-center rounded-lg bg-violet-500/10 border border-violet-500/30 py-2 text-sm text-violet-300 hover:bg-violet-500/20">View Bill/Invoice</a>}
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      {editExpense && <ExpenseForm expense={editExpense} onClose={() => setEditExpense(null)} onSaved={() => { setEditExpense(null); load(); }} />}
    </div>
  );
}

function ExpenseForm({ expense, onClose, onSaved }: { expense?: Expense; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    expense_id: expense?.expense_id ?? generateExpenseId(),
    date: expense?.date ?? todayISO(),
    category: expense?.category ?? 'Mandap',
    description: expense?.description ?? '',
    amount: expense ? String(expense.amount) : '',
    payment_method: expense?.payment_method ?? 'Cash',
    paid_to: expense?.paid_to ?? '',
    added_by: expense?.added_by ?? '',
    notes: expense?.notes ?? '',
  });

  const field = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors';
  const labelClass = 'block text-sm font-medium text-zinc-300 mb-1.5';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount) { toast('Description and amount are required', 'warning'); return; }
    setSaving(true);
    try {
      const payload = {
        expense_id: form.expense_id,
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        payment_method: form.payment_method,
        paid_to: form.paid_to || null,
        added_by: form.added_by || null,
        notes: form.notes || null,
      };

      if (expense) {
        const { error } = await supabase.from('expenses').update(payload).eq('id', expense.id);
        if (error) throw error;
        await logAudit({ action: 'Expense Edited', record_id: form.expense_id, record_type: 'expense', previous_value: expense as unknown as Record<string, unknown>, new_value: payload as Record<string, unknown> });
        toast('Expense updated', 'success');
      } else {
        const { error } = await supabase.from('expenses').insert(payload);
        if (error) throw error;
        await logAudit({ action: 'Expense Added', record_id: form.expense_id, record_type: 'expense', new_value: payload as Record<string, unknown> });
        toast('Expense added', 'success');
      }
      onSaved();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save expense', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={expense ? 'Edit Expense' : 'Add Expense'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Expense ID</label><input value={form.expense_id} onChange={(e) => field('expense_id', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Date</label><input type="date" value={form.date} onChange={(e) => field('date', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Category</label>
            <select value={form.category} onChange={(e) => field('category', e.target.value)} className={inputClass}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Amount *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => field('amount', e.target.value)} className={inputClass} placeholder="0" /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Description *</label><input value={form.description} onChange={(e) => field('description', e.target.value)} className={inputClass} placeholder="Expense description" /></div>
          <div><label className={labelClass}>Payment Method</label>
            <select value={form.payment_method} onChange={(e) => field('payment_method', e.target.value)} className={inputClass}>
              <option>Cash</option><option>UPI</option><option>Bank Transfer</option><option>Other</option>
            </select>
          </div>
          <div><label className={labelClass}>Paid To</label><input value={form.paid_to} onChange={(e) => field('paid_to', e.target.value)} className={inputClass} placeholder="Vendor name" /></div>
          <div><label className={labelClass}>Added By</label><input value={form.added_by} onChange={(e) => field('added_by', e.target.value)} className={inputClass} placeholder="Your name" /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Notes</label><textarea value={form.notes} onChange={(e) => field('notes', e.target.value)} rows={2} className={inputClass} placeholder="Additional notes" /></div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white flex items-center gap-1"><X className="h-4 w-4" /> Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving...' : expense ? 'Save Changes' : 'Add Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
