import { supabase } from '@/lib/supabase';

export async function logAudit(entry: {
  action: string;
  record_id?: string;
  record_type?: string;
  previous_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email ?? 'Unknown';

  await supabase.from('audit_logs').insert({
    action: entry.action,
    record_id: entry.record_id ?? null,
    record_type: entry.record_type ?? null,
    previous_value: entry.previous_value ?? null,
    new_value: entry.new_value ?? null,
    user_email: email,
    verification_status: 'Pending',
  });
}
