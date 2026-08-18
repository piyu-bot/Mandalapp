import { useEffect, useMemo, useState } from 'react';
import Papa from 'papaparse';
import { supabase, type Receipt, type Expense } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { formatCurrency, formatDate, todayISO } from '@/lib/utils';
import {
  FileText, Download, FileSpreadsheet, Printer, Loader2, BarChart3,
} from '@/components/icons';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const REPORT_TYPES = [
  { id: 'daily', label: 'Daily Collection Report' },
  { id: 'monthly', label: 'Monthly Collection Report' },
  { id: 'expense', label: 'Total Expense Report' },
  { id: 'pending', label: 'Pending Collection Report' },
  { id: 'member', label: 'Member Collection Report' },
  { id: 'category', label: 'Category-wise Expense Report' },
  { id: 'income_expense', label: 'Income vs Expense Report' },
  { id: 'summary', label: 'Complete Financial Summary' },
];

export default function Reports() {
  const { toast } = useToast();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reportType, setReportType] = useState('summary');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(todayISO());
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    const [r, e] = await Promise.all([
      supabase.from('receipts').select('*').order('date', { ascending: false }),
      supabase.from('expenses').select('*').order('date', { ascending: false }),
    ]);
    if (r.error || e.error) { setError(true); }
    else { setReceipts(r.data as Receipt[]); setExpenses(e.data as Expense[]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const inRange = (date: string) => {
    const d = date.split('T')[0];
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const filteredReceipts = useMemo(() => receipts.filter((r) => inRange(r.date)), [receipts, fromDate, toDate]);
  const filteredExpenses = useMemo(() => expenses.filter((e) => inRange(e.date)), [expenses, fromDate, toDate]);

  const totalCollection = filteredReceipts.reduce((s, r) => s + Number(r.paid_amount), 0);
  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0);
  const pendingAmount = filteredReceipts.filter((r) => r.status !== 'Paid').reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount)), 0);

  // Monthly comparison chart
  const monthlyData = useMemo(() => {
    const map = new Map<string, { collection: number; expense: number }>();
    [...filteredReceipts, ...filteredExpenses].forEach((item) => {
      const d = new Date('date' in item ? item.date : (item as Expense).date);
      const key = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const entry = map.get(key) ?? { collection: 0, expense: 0 };
      if ('donor_name' in item) entry.collection += Number(item.paid_amount);
      else entry.expense += Number(item.amount);
      map.set(key, entry);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name, ...v }));
  }, [filteredReceipts, filteredExpenses]);

  const getReportData = (): Record<string, string | number>[] => {
    switch (reportType) {
      case 'daily': {
        const byDay = new Map<string, { date: string; count: number; amount: number }>();
        filteredReceipts.forEach((r) => {
          const d = r.date;
          const entry = byDay.get(d) ?? { date: d, count: 0, amount: 0 };
          entry.count++; entry.amount += Number(r.paid_amount);
          byDay.set(d, entry);
        });
        return Array.from(byDay.values()).map((r) => ({ Date: r.date, 'Receipt Count': r.count, 'Collected Amount': r.amount }));
      }
      case 'monthly': {
        const byMonth = new Map<string, { month: string; count: number; amount: number }>();
        filteredReceipts.forEach((r) => {
          const d = new Date(r.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const entry = byMonth.get(key) ?? { month: key, count: 0, amount: 0 };
          entry.count++; entry.amount += Number(r.paid_amount);
          byMonth.set(key, entry);
        });
        return Array.from(byMonth.values()).map((r) => ({ Month: r.month, 'Receipt Count': r.count, 'Collected Amount': r.amount }));
      }
      case 'expense':
        return filteredExpenses.map((e) => ({ 'Expense ID': e.expense_id, Date: e.date, Category: e.category, Description: e.description, Amount: e.amount, 'Paid To': e.paid_to ?? '', 'Payment Method': e.payment_method }));
      case 'pending':
        return filteredReceipts.filter((r) => r.status !== 'Paid').map((r) => ({ 'Receipt No': r.receipt_number, Name: r.donor_name, Mobile: r.mobile ?? '', 'Expected Amount': r.amount, 'Paid Amount': r.paid_amount, 'Pending Amount': Number(r.amount) - Number(r.paid_amount), Status: r.status, Date: r.date }));
      case 'member': {
        const byMember = new Map<string, { name: string; count: number; amount: number }>();
        filteredReceipts.forEach((r) => {
          const entry = byMember.get(r.donor_name) ?? { name: r.donor_name, count: 0, amount: 0 };
          entry.count++; entry.amount += Number(r.paid_amount);
          byMember.set(r.donor_name, entry);
        });
        return Array.from(byMember.values()).map((r) => ({ 'Donor Name': r.name, 'Receipt Count': r.count, 'Total Contributed': r.amount }));
      }
      case 'category': {
        const byCat = new Map<string, { category: string; count: number; amount: number }>();
        filteredExpenses.forEach((e) => {
          const entry = byCat.get(e.category) ?? { category: e.category, count: 0, amount: 0 };
          entry.count++; entry.amount += Number(e.amount);
          byCat.set(e.category, entry);
        });
        return Array.from(byCat.values()).map((r) => ({ Category: r.category, 'Expense Count': r.count, 'Total Amount': r.amount }));
      }
      case 'income_expense':
        return [{ 'Total Collection': totalCollection, 'Total Expenses': totalExpenses, 'Net Balance': totalCollection - totalExpenses, 'Pending Amount': pendingAmount }];
      case 'summary':
      default: {
        const summary: Record<string, string | number>[] = [
          { Metric: 'Total Collection', Value: totalCollection },
          { Metric: 'Total Expenses', Value: totalExpenses },
          { Metric: 'Pending Amount', Value: pendingAmount },
          { Metric: 'Net Balance', Value: totalCollection - totalExpenses },
          { Metric: 'Total Receipts', Value: filteredReceipts.length },
          { Metric: 'Total Expenses Recorded', Value: filteredExpenses.length },
        ];
        return summary;
      }
    }
  };

  const handleExportCSV = async () => {
    const data = getReportData();
    if (data.length === 0) { toast('No data to export', 'warning'); return; }
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}_report_${todayISO()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    await logAudit({ action: 'Data Exported', record_type: 'report', new_value: { type: reportType, format: 'CSV', rows: data.length } as Record<string, unknown> });
    toast('CSV exported successfully', 'success');
  };

  const handlePrint = async () => {
    const data = getReportData();
    if (data.length === 0) { toast('No data to print', 'warning'); return; }
    const headers = Object.keys(data[0]);
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast('Please allow popups to print', 'warning'); return; }
    printWindow.document.write(`
      <!doctype html><html><head><title>${REPORT_TYPES.find((r) => r.id === reportType)?.label}</title>
      <style>
        * { font-family: 'Inter', sans-serif; }
        body { margin: 40px; color: #18181b; }
        h1 { color: #ea580c; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
        th { background: #f4f4f5; padding: 10px; text-align: left; border-bottom: 2px solid #e4e4e7; }
        td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; }
        .header { text-align: center; margin-bottom: 20px; }
        .header h1 { margin: 0; } .header p { color: #71717a; margin: 4px 0; }
      </style></head><body>
      <div class="header"><h1>अष्टविनायक गणेशोत्सव मंडळ</h1><p>${REPORT_TYPES.find((r) => r.id === reportType)?.label}</p><p>${fromDate || 'All'} to ${toDate}</p></div>
      <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${data.map((row) => `<tr>${headers.map((h) => `<td>${row[h]}</td>`).join('')}</tr>`).join('')}</tbody></table>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
    await logAudit({ action: 'Report Generated', record_type: 'report', new_value: { type: reportType, format: 'Print' } as Record<string, unknown> });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    await new Promise((r) => setTimeout(r, 500));
    await logAudit({ action: 'Report Generated', record_type: 'report', new_value: { type: reportType, fromDate, toDate } as Record<string, unknown> });
    setGenerating(false);
    toast('Report generated successfully', 'success');
  };

  if (loading) return <Card><TableSkeleton rows={5} /></Card>;
  if (error) return <Card><ErrorState message="Failed to load data." onRetry={load} /></Card>;

  const reportData = getReportData();

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader title="Financial Reports & CSV" subtitle="Generate and export financial reports" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">Report Type</label>
              <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500/50 focus:outline-none">
                {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">From Date</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500/50 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1.5">To Date</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-orange-500/50 focus:outline-none" />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <button onClick={handleGenerate} disabled={generating} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 transition-all">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />} Generate Report
            </button>
            <button onClick={handleExportCSV} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Export CSV
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors">
              <Printer className="h-4 w-4 text-sky-400" /> Print Report
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><CardBody className="p-4"><p className="text-xs text-zinc-400">Total Collection</p><p className="mt-1 text-lg font-bold text-emerald-400">{formatCurrency(totalCollection)}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-zinc-400">Total Expenses</p><p className="mt-1 text-lg font-bold text-red-400">{formatCurrency(totalExpenses)}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-zinc-400">Pending Amount</p><p className="mt-1 text-lg font-bold text-amber-400">{formatCurrency(pendingAmount)}</p></CardBody></Card>
        <Card><CardBody className="p-4"><p className="text-xs text-zinc-400">Net Balance</p><p className="mt-1 text-lg font-bold text-orange-400">{formatCurrency(totalCollection - totalExpenses)}</p></CardBody></Card>
      </div>

      {/* Chart */}
      {monthlyData.length > 0 && (
        <Card>
          <CardHeader title="Monthly Comparison" subtitle="Income vs Expenses over time" />
          <CardBody>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff20', borderRadius: '12px', color: '#fff' }} formatter={(v) => formatCurrency(Number(v))} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="collection" name="Collection" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Report Data Table */}
      <Card>
        <CardHeader title={REPORT_TYPES.find((r) => r.id === reportType)?.label ?? 'Report'} subtitle={`${reportData.length} records`} />
        {reportData.length === 0 ? (
          <EmptyState icon={<FileText className="h-7 w-7" />} title="No data available" message="No records match the selected filters." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left text-xs text-zinc-400">
                  {Object.keys(reportData[0]).map((h) => <th key={h} className="px-5 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {reportData.map((row, i) => (
                  <tr key={i} className="hover:bg-white/5 transition-colors">
                    {Object.values(row).map((v, j) => {
                      const isAmount = typeof v === 'number' && (Object.keys(row)[j].includes('Amount') || Object.keys(row)[j].includes('Collection') || Object.keys(row)[j].includes('Expense') || Object.keys(row)[j].includes('Balance') || Object.keys(row)[j].includes('Contributed') || Object.keys(row)[j].includes('Value'));
                      return <td key={j} className={`px-5 py-3 ${isAmount ? 'font-semibold text-white' : 'text-zinc-300'}`}>{isAmount ? formatCurrency(v as number) : String(v)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
