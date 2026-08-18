import { useEffect, useMemo, useState } from 'react';
import { supabase, type AuditLog } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { formatDateTime } from '@/lib/utils';
import {
  Search, ShieldCheck, CheckCircle2, XCircle, Eye,
  ChevronLeft, ChevronRight,
} from '@/components/icons';
import { Modal } from '@/components/Modal';

const PAGE_SIZE = 15;

export default function AuditLogPage() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [viewLog, setViewLog] = useState<AuditLog | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    if (error) { setError(true); }
    else { setLogs(data as AuditLog[]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let result = logs;
    if (statusFilter !== 'all') result = result.filter((l) => l.verification_status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((l) =>
        l.action.toLowerCase().includes(q) ||
        (l.record_id ?? '').toLowerCase().includes(q) ||
        (l.user_email ?? '').toLowerCase().includes(q) ||
        (l.record_type ?? '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const updateVerification = async (log: AuditLog, status: 'Verified' | 'Rejected') => {
    const ok = await confirm({
      title: `${status === 'Verified' ? 'Verify' : 'Reject'} Entry`,
      message: `Mark action "${log.action}" as ${status.toLowerCase()}?`,
      confirmText: status,
      danger: status === 'Rejected',
    });
    if (!ok) return;
    const { error } = await supabase.from('audit_logs').update({ verification_status: status }).eq('id', log.id);
    if (error) { toast('Failed to update verification', 'error'); return; }
    await logAudit({
      action: 'Verification Completed',
      record_id: log.id,
      record_type: 'audit_log',
      previous_value: { verification_status: log.verification_status } as Record<string, unknown>,
      new_value: { verification_status: status },
    });
    toast(`Entry ${status.toLowerCase()}`, 'success');
    load();
  };

  const filters = ['all', 'Pending', 'Verified', 'Rejected'];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Audit Log & Verification" subtitle="Transparent record of all financial actions" />
        <CardBody>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by action, user, record..." className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none" />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((f) => (
                <button key={f} onClick={() => { setStatusFilter(f); setPage(1); }} className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${statusFilter === f ? 'border-orange-500 bg-orange-500/15 text-orange-300' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}>
                  {f === 'all' ? 'All' : f}
                </button>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        {loading ? (
          <TableSkeleton rows={8} />
        ) : error ? (
          <ErrorState message="Failed to load audit logs." onRetry={load} />
        ) : paged.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="No audit entries" message="Financial actions will be logged here automatically." />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-xs text-zinc-400">
                    <th className="px-5 py-3 font-medium">Date & Time</th>
                    <th className="px-5 py-3 font-medium">User</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                    <th className="px-5 py-3 font-medium">Record ID</th>
                    <th className="px-5 py-3 font-medium">Type</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {paged.map((log) => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-5 py-3 text-zinc-400 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                      <td className="px-5 py-3 text-zinc-300">{log.user_email ?? '-'}</td>
                      <td className="px-5 py-3 font-medium text-white">{log.action}</td>
                      <td className="px-5 py-3 text-zinc-400 font-mono text-xs">{log.record_id ?? '-'}</td>
                      <td className="px-5 py-3 text-zinc-400">{log.record_type ?? '-'}</td>
                      <td className="px-5 py-3"><Badge label={log.verification_status} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setViewLog(log)} title="View" className="rounded-md p-1.5 text-sky-400 hover:bg-sky-500/10"><Eye className="h-4 w-4" /></button>
                          {log.verification_status === 'Pending' && (
                            <>
                              <button onClick={() => updateVerification(log, 'Verified')} title="Verify" className="rounded-md p-1.5 text-emerald-400 hover:bg-emerald-500/10"><CheckCircle2 className="h-4 w-4" /></button>
                              <button onClick={() => updateVerification(log, 'Rejected')} title="Reject" className="rounded-md p-1.5 text-red-400 hover:bg-red-500/10"><XCircle className="h-4 w-4" /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="space-y-3 p-4 lg:hidden">
              {paged.map((log) => (
                <div key={log.id} className="rounded-xl border border-white/5 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white text-sm">{log.action}</span>
                    <Badge label={log.verification_status} />
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{formatDateTime(log.created_at)} · {log.user_email ?? '-'}</p>
                  <p className="text-xs text-zinc-400 mt-1">Record: {log.record_id ?? '-'} ({log.record_type ?? '-'})</p>
                  {log.verification_status === 'Pending' && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => updateVerification(log, 'Verified')} className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-xs text-emerald-300"><CheckCircle2 className="h-3 w-3" /> Verify</button>
                      <button onClick={() => updateVerification(log, 'Rejected')} className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-xs text-red-300"><XCircle className="h-3 w-3" /> Reject</button>
                      <button onClick={() => setViewLog(log)} className="flex items-center gap-1 rounded-md bg-sky-500/10 px-2 py-1 text-xs text-sky-300"><Eye className="h-3 w-3" /> View</button>
                    </div>
                  )}
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

      {/* View Modal */}
      <Modal open={!!viewLog} onClose={() => setViewLog(null)} title="Audit Entry Details" size="md">
        {viewLog && (
          <div className="space-y-3">
            {[
              ['Date & Time', formatDateTime(viewLog.created_at)],
              ['User', viewLog.user_email ?? '-'],
              ['Action', viewLog.action],
              ['Record ID', viewLog.record_id ?? '-'],
              ['Record Type', viewLog.record_type ?? '-'],
              ['Verification Status', viewLog.verification_status],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between border-b border-white/5 pb-2">
                <span className="text-sm text-zinc-400">{label}</span>
                {label === 'Verification Status' ? <Badge label={viewLog.verification_status} /> : <span className="text-sm font-medium text-white">{value}</span>}
              </div>
            ))}
            {viewLog.previous_value && (
              <div>
                <p className="text-sm text-zinc-400 mb-1">Previous Value</p>
                <pre className="rounded-lg bg-white/5 p-3 text-xs text-zinc-300 overflow-x-auto">{JSON.stringify(viewLog.previous_value, null, 2)}</pre>
              </div>
            )}
            {viewLog.new_value && (
              <div>
                <p className="text-sm text-zinc-400 mb-1">New Value</p>
                <pre className="rounded-lg bg-white/5 p-3 text-xs text-zinc-300 overflow-x-auto">{JSON.stringify(viewLog.new_value, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
