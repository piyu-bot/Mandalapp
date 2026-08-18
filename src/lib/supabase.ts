import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export type Member = {
  id: string;
  name: string;
  mobile: string | null;
  address: string | null;
  role: 'President' | 'Secretary' | 'Treasurer' | 'Member' | 'Volunteer';
  responsibility: string | null;
  joining_date: string;
  attendance_count: number;
  attendance_total: number;
  tasks_completed: number;
  events_participated: number;
  status: 'Active' | 'Inactive';
  photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Receipt = {
  id: string;
  receipt_number: string;
  date: string;
  donor_name: string;
  mobile: string | null;
  address: string | null;
  amount: number;
  paid_amount: number;
  payment_method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';
  purpose: string | null;
  collected_by: string | null;
  notes: string | null;
  status: 'Paid' | 'Pending' | 'Partially Paid' | 'Overdue';
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  expense_id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: 'Cash' | 'UPI' | 'Bank Transfer' | 'Other';
  paid_to: string | null;
  added_by: string | null;
  bill_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  action: string;
  record_id: string | null;
  record_type: string | null;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  user_email: string | null;
  verification_status: 'Pending' | 'Verified' | 'Rejected';
  created_at: string;
};
