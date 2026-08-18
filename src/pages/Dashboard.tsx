import { useEffect, useState } from 'react';
import { supabase, type Receipt, type Expense } from '@/lib/supabase';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { CardSkeleton, TableSkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { Badge } from '@/components/Badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Clock, CheckCircle, Users,
  IndianRupee, FileText, Wallet, AlertCircle,
} from '@/components/icons';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

type Stats = {
  totalCollection: number;
  totalExpenses: number;
  pendingAmount: number;
  verifiedAmount: number;
  totalMembers: number;
};

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentReceipts, setRecentReceipts] = useState<Receipt[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [chartData, setChartData] = useState<{ name: string; collection: number; expense: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const [receiptsRes, expensesRes, membersRes, verifiedRes] = await Promise.all([
        supabase.from('receipts').select('*').order('created_at', { ascending: false }),
        supabase.from('expenses').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('audit_logs').select('new_value').eq('verification_status', 'Verified'),
      ]);

      if (receiptsRes.error) throw receiptsRes.error;
      if (expensesRes.error) throw expensesRes.error;

      const receipts = receiptsRes.data as Receipt[];
      const expenses = expensesRes.data as Expense[];

      const totalCollection = receipts.reduce((s, r) => s + Number(r.paid_amount), 0);
      const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const pendingAmount = receipts
        .filter((r) => r.status !== 'Paid')
        .reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount)), 0);

      // Verified amount: sum of verified receipt amounts from audit logs
      const verifiedAmount = (verifiedRes.data ?? []).reduce((s, log) => {
        const val = log.new_value as { paid_amount?: number } | null;
        return s + (val?.paid_amount ? Number(val.paid_amount) : 0);
      }, 0);

      setStats({
        totalCollection,
        totalExpenses,
        pendingAmount,
        verifiedAmount,
        totalMembers: membersRes.count ?? 0,
      });
      setRecentReceipts(receipts.slice(0, 5));
      setRecentExpenses(expenses.slice(0, 5));

      // Build chart data: last 6 months
      const months: { name: string; collection: number; expense: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString('en-US', { month: 'short' });
        const col = receipts
          .filter((r) => {
            const rd = new Date(r.date);
            return rd.getMonth() === d.getMonth() && rd.getFullYear() === d.getFullYear();
          })
          .reduce((s, r) => s + Number(r.paid_amount), 0);
        const exp = expenses
          .filter((e) => {
            const ed = new Date(e.date);
            return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
          })
          .reduce((s, e) => s + Number(e.amount), 0);
        months.push({ name: key, collection: col, expense: exp });
      }
      setChartData(months);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorState message="Failed to load dashboard data." onRetry={load} />;

  const cards = [
    { label: 'Total Collection', value: stats ? formatCurrency(stats.totalCollection) : '', icon: TrendingUp, color: 'from-emerald-500/20 to-emerald-600/5', iconColor: 'text-emerald-400' },
    { label: 'Total Expenses', value: stats ? formatCurrency(stats.totalExpenses) : '', icon: TrendingDown, color: 'from-red-500/20 to-red-600/5', iconColor: 'text-red-400' },
    { label: 'Pending Amount', value: stats ? formatCurrency(stats.pendingAmount) : '', icon: Clock, color: 'from-amber-500/20 to-amber-600/5', iconColor: 'text-amber-400' },
    { label: 'Verified Amount', value: stats ? formatCurrency(stats.verifiedAmount) : '', icon: CheckCircle, color: 'from-sky-500/20 to-sky-600/5', iconColor: 'text-sky-400' },
    { label: 'Total Members', value: stats ? String(stats.totalMembers) : '', icon: Users, color: 'from-violet-500/20 to-violet-600/5', iconColor: 'text-violet-400' },
    { label: 'Net Balance', value: stats ? formatCurrency(stats.totalCollection - stats.totalExpenses) : '', icon: IndianRupee, color: 'from-orange-500/20 to-orange-600/5', iconColor: 'text-orange-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
          : cards.map((c) => (
              <Card key={c.label} className={`bg-gradient-to-br ${c.color}`}>
                <CardBody className="p-4">
                  <div className="flex items-center justify-between">
                    <c.icon className={`h-8 w-8 ${c.iconColor}`} />
                  </div>
                  <p className="mt-3 text-xl font-bold text-white">{c.value}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{c.label}</p>
                </CardBody>
              </Card>
            ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader title="Collection vs Expense" subtitle="Last 6 months overview" />
        <CardBody>
          {loading ? (
            <div className="h-72" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#18181b', border: '1px solid #ffffff20', borderRadius: '12px', color: '#fff' }}
                  formatter={(v) => formatCurrency(Number(v))}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="collection" name="Collection" stroke="#10b981" fill="url(#colGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#expGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardBody>
      </Card>

      {/* Recent Activity */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Receipts" subtitle="Latest donations collected" />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : recentReceipts.length === 0 ? (
            <EmptyState icon={<FileText className="h-7 w-7" />} title="No receipts yet" message="Add your first receipt to see it here." />
          ) : (
            <div className="divide-y divide-white/5">
              {recentReceipts.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{r.donor_name}</p>
                    <p className="text-xs text-zinc-500">{r.receipt_number} · {formatDate(r.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-emerald-400">{formatCurrency(Number(r.paid_amount))}</span>
                    <Badge label={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent Expenses" subtitle="Latest spending" />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : recentExpenses.length === 0 ? (
            <EmptyState icon={<Wallet className="h-7 w-7" />} title="No expenses yet" message="Add an expense to track spending." />
          ) : (
            <div className="divide-y divide-white/5">
              {recentExpenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">{e.description}</p>
                    <p className="text-xs text-zinc-500">{e.category} · {formatDate(e.date)}</p>
                  </div>
                  <span className="text-sm font-semibold text-red-400">{formatCurrency(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Summary */}
      {!loading && stats && (
        <Card>
          <CardHeader title="Quick Financial Summary" subtitle="At-a-glance status" />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-xs"><TrendingUp className="h-4 w-4 text-emerald-400" /> Money In</div>
                <p className="mt-2 text-lg font-bold text-emerald-400">{formatCurrency(stats.totalCollection)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-xs"><TrendingDown className="h-4 w-4 text-red-400" /> Money Out</div>
                <p className="mt-2 text-lg font-bold text-red-400">{formatCurrency(stats.totalExpenses)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-xs"><Clock className="h-4 w-4 text-amber-400" /> Pending</div>
                <p className="mt-2 text-lg font-bold text-amber-400">{formatCurrency(stats.pendingAmount)}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="flex items-center gap-2 text-zinc-400 text-xs"><AlertCircle className="h-4 w-4 text-orange-400" /> Net Balance</div>
                <p className="mt-2 text-lg font-bold text-orange-400">{formatCurrency(stats.totalCollection - stats.totalExpenses)}</p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
