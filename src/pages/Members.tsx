import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase, type Member } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useConfirm } from '@/context/ConfirmContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState } from '@/components/EmptyState';
import { TableSkeleton } from '@/components/Skeleton';
import { formatDate } from '@/lib/utils';
import {
  Search, Plus, Trash2, Pencil, Users, UserPlus,
  Loader2, X,
} from '@/components/icons';

const ROLES = ['President', 'Secretary', 'Treasurer', 'Member', 'Volunteer'] as const;

export default function Members() {
  const { toast } = useToast();
  const { confirm } = useConfirm();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);

  const load = async () => {
    setLoading(true);
    setError(false);
    const { data, error } = await supabase.from('members').select('*').order('created_at', { ascending: false });
    if (error) { setError(true); }
    else { setMembers(data as Member[]); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return members;
    const q = search.toLowerCase();
    return members.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      (m.mobile ?? '').includes(q) ||
      m.role.toLowerCase().includes(q) ||
      (m.responsibility ?? '').toLowerCase().includes(q)
    );
  }, [members, search]);

  const handleDelete = async (m: Member) => {
    const ok = await confirm({
      title: 'Delete Member',
      message: `Remove ${m.name} from the Mandal? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from('members').delete().eq('id', m.id);
    if (error) { toast('Failed to delete member', 'error'); return; }
    await logAudit({ action: 'Member Deleted', record_id: m.id, record_type: 'member', previous_value: m as unknown as Record<string, unknown> });
    toast('Member removed', 'info');
    load();
  };

  const handleSave = async (data: Partial<Member>, existing?: Member) => {
    if (existing) {
      const { error } = await supabase.from('members').update(data).eq('id', existing.id);
      if (error) { toast('Failed to update member', 'error'); return; }
      await logAudit({ action: 'Member Updated', record_id: existing.id, record_type: 'member', previous_value: existing as unknown as Record<string, unknown>, new_value: data as Record<string, unknown> });
      toast('Member updated', 'success');
    } else {
      const { error } = await supabase.from('members').insert(data);
      if (error) { toast('Failed to add member', 'error'); return; }
      await logAudit({ action: 'Member Added', record_type: 'member', new_value: data as Record<string, unknown> });
      toast('Member added', 'success');
    }
    setEditMember(null);
    setShowForm(false);
    load();
  };

  const attendancePct = (m: Member) => m.attendance_total > 0 ? Math.round((m.attendance_count / m.attendance_total) * 100) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Member & Performance"
          subtitle="Manage Mandal members and track performance"
          action={
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-500 hover:to-amber-500 transition-all">
              <UserPlus className="h-4 w-4" /> Add Member
            </button>
          }
        />
        <CardBody>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members..." className="w-full rounded-lg border border-white/10 bg-white/5 pl-10 pr-4 py-2 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none" />
          </div>
        </CardBody>
      </Card>

      {loading ? (
        <Card><TableSkeleton rows={5} /></Card>
      ) : error ? (
        <Card><ErrorState message="Failed to load members." onRetry={load} /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Users className="h-7 w-7" />} title="No members yet" message="Add Mandal members to track their performance." action={<button onClick={() => setShowForm(true)} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500">Add Member</button>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => {
            const att = attendancePct(m);
            return (
              <Card key={m.id} className="hover:border-white/20 transition-colors">
                <CardBody className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/20 to-amber-600/10 text-lg font-bold text-orange-400">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="truncate font-semibold text-white">{m.name}</h3>
                        <div className="flex gap-1">
                          <button onClick={() => setEditMember(m)} className="rounded-md p-1 text-zinc-400 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => handleDelete(m)} className="rounded-md p-1 text-red-400 hover:bg-red-500/10"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge label={m.role} />
                        <Badge label={m.status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-zinc-400">Mobile</span><span className="text-zinc-200">{m.mobile ?? '-'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Responsibility</span><span className="text-zinc-200">{m.responsibility ?? '-'}</span></div>
                    <div className="flex justify-between"><span className="text-zinc-400">Joined</span><span className="text-zinc-200">{formatDate(m.joining_date)}</span></div>
                  </div>

                  {/* Performance bars */}
                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">Attendance</span><span className="text-white">{att}%</span></div>
                      <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                        <div className={`h-full rounded-full ${att >= 75 ? 'bg-emerald-500' : att >= 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${att}%` }} />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs"><span className="text-zinc-400">Tasks Completed</span><span className="text-white font-semibold">{m.tasks_completed}</span></div>
                    <div className="flex justify-between text-xs"><span className="text-zinc-400">Events Participated</span><span className="text-white font-semibold">{m.events_participated}</span></div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {(showForm || editMember) && (
        <MemberForm member={editMember ?? undefined} onClose={() => { setShowForm(false); setEditMember(null); }} onSave={handleSave} />
      )}
    </div>
  );
}

function MemberForm({ member, onClose, onSave }: { member?: Member; onClose: () => void; onSave: (data: Partial<Member>, existing?: Member) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: member?.name ?? '',
    mobile: member?.mobile ?? '',
    address: member?.address ?? '',
    role: member?.role ?? 'Member',
    responsibility: member?.responsibility ?? '',
    joining_date: member?.joining_date ?? new Date().toISOString().split('T')[0],
    attendance_count: String(member?.attendance_count ?? 0),
    attendance_total: String(member?.attendance_total ?? 0),
    tasks_completed: String(member?.tasks_completed ?? 0),
    events_participated: String(member?.events_participated ?? 0),
    status: member?.status ?? 'Active',
  });

  const field = (key: keyof typeof form, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors';
  const labelClass = 'block text-sm font-medium text-zinc-300 mb-1.5';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    await onSave({
      name: form.name,
      mobile: form.mobile || null,
      address: form.address || null,
      role: form.role as Member['role'],
      responsibility: form.responsibility || null,
      joining_date: form.joining_date,
      attendance_count: Number(form.attendance_count),
      attendance_total: Number(form.attendance_total),
      tasks_completed: Number(form.tasks_completed),
      events_participated: Number(form.events_participated),
      status: form.status as Member['status'],
    }, member);
    setSaving(false);
  };

  return (
    <Modal open onClose={onClose} title={member ? 'Edit Member' : 'Add Member'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={labelClass}>Name *</label><input value={form.name} onChange={(e) => field('name', e.target.value)} className={inputClass} placeholder="Full name" /></div>
          <div><label className={labelClass}>Mobile</label><input value={form.mobile} onChange={(e) => field('mobile', e.target.value)} className={inputClass} placeholder="98XXXXXXXX" /></div>
          <div className="sm:col-span-2"><label className={labelClass}>Address</label><input value={form.address} onChange={(e) => field('address', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Role</label>
            <select value={form.role} onChange={(e) => field('role', e.target.value)} className={inputClass}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div><label className={labelClass}>Status</label>
            <select value={form.status} onChange={(e) => field('status', e.target.value)} className={inputClass}>
              <option>Active</option><option>Inactive</option>
            </select>
          </div>
          <div><label className={labelClass}>Responsibility</label><input value={form.responsibility} onChange={(e) => field('responsibility', e.target.value)} className={inputClass} placeholder="Assigned responsibility" /></div>
          <div><label className={labelClass}>Joining Date</label><input type="date" value={form.joining_date} onChange={(e) => field('joining_date', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Attendance Count</label><input type="number" value={form.attendance_count} onChange={(e) => field('attendance_count', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Attendance Total</label><input type="number" value={form.attendance_total} onChange={(e) => field('attendance_total', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Tasks Completed</label><input type="number" value={form.tasks_completed} onChange={(e) => field('tasks_completed', e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>Events Participated</label><input type="number" value={form.events_participated} onChange={(e) => field('events_participated', e.target.value)} className={inputClass} /></div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white flex items-center gap-1"><X className="h-4 w-4" /> Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-500 disabled:opacity-50 flex items-center gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {saving ? 'Saving...' : member ? 'Save Changes' : 'Add Member'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
