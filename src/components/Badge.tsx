import { cn } from '@/lib/utils';

type Variant = 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue' | 'Active' | 'Inactive' | 'Verified' | 'Rejected' | 'President' | 'Secretary' | 'Treasurer' | 'Member' | 'Volunteer';

const styles: Record<string, string> = {
  Paid: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Verified: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Pending: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Partially Paid': 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Overdue: 'bg-red-500/15 text-red-300 border-red-500/30',
  Rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  Inactive: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  President: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Secretary: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Treasurer: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Member: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  Volunteer: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
};

export function Badge({ label, className }: { label: Variant | string; className?: string }) {
  const style = styles[label] ?? 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30';
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', style, className)}>
      {label}
    </span>
  );
}
