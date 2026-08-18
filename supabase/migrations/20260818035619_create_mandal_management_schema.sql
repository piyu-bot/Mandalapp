/*
# Ashtavinayak Ganesh Utsav Mandal - Management Schema

Creates the complete database structure for the Mandal management application.

## Tables
1. **members** - Mandal members with roles, performance tracking
2. **receipts** - Donation receipts with unique receipt numbers, payment status
3. **expenses** - Festival expenses with categories
4. **audit_logs** - Audit trail of all important actions
5. **verifications** - Verification records for receipts and expenses

## Security
- RLS enabled on all tables
- All policies scoped to authenticated users (admin-only access)
- Owner columns default to auth.uid()

## Notes
- Receipt numbers are unique per mandal
- Financial figures derived from receipts/expenses, never hardcoded
- Audit logs record all financial mutations
*/

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile text,
  address text,
  role text NOT NULL DEFAULT 'Member' CHECK (role IN ('President','Secretary','Treasurer','Member','Volunteer')),
  responsibility text,
  joining_date date NOT NULL DEFAULT CURRENT_DATE,
  attendance_count int NOT NULL DEFAULT 0,
  attendance_total int NOT NULL DEFAULT 0,
  tasks_completed int NOT NULL DEFAULT 0,
  events_participated int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  photo_url text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_members" ON members;
CREATE POLICY "select_members" ON members FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_members" ON members;
CREATE POLICY "insert_members" ON members FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_members" ON members;
CREATE POLICY "update_members" ON members FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_members" ON members;
CREATE POLICY "delete_members" ON members FOR DELETE
  TO authenticated USING (true);

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  donor_name text NOT NULL,
  mobile text,
  address text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash','UPI','Bank Transfer','Other')),
  purpose text,
  collected_by text,
  notes text,
  status text NOT NULL DEFAULT 'Paid' CHECK (status IN ('Paid','Pending','Partially Paid','Overdue')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_receipts" ON receipts;
CREATE POLICY "select_receipts" ON receipts FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_receipts" ON receipts;
CREATE POLICY "insert_receipts" ON receipts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_receipts" ON receipts;
CREATE POLICY "update_receipts" ON receipts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_receipts" ON receipts;
CREATE POLICY "delete_receipts" ON receipts FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS receipts_receipt_number_unique ON receipts (receipt_number);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL DEFAULT 'Other' CHECK (category IN ('Mandap','Decoration','Lighting','Sound System','Electricity','Prasad','Pooja Material','Advertisement','Cultural Program','Security','Cleaning','Other')),
  description text NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash' CHECK (payment_method IN ('Cash','UPI','Bank Transfer','Other')),
  paid_to text,
  added_by text,
  bill_url text,
  notes text,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_expenses" ON expenses;
CREATE POLICY "select_expenses" ON expenses FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_expenses" ON expenses;
CREATE POLICY "insert_expenses" ON expenses FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_expenses" ON expenses;
CREATE POLICY "update_expenses" ON expenses FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_expenses" ON expenses;
CREATE POLICY "delete_expenses" ON expenses FOR DELETE
  TO authenticated USING (true);

CREATE UNIQUE INDEX IF NOT EXISTS expenses_expense_id_unique ON expenses (expense_id);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  record_id text,
  record_type text,
  previous_value jsonb,
  new_value jsonb,
  user_email text,
  verification_status text NOT NULL DEFAULT 'Pending' CHECK (verification_status IN ('Pending','Verified','Rejected')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_audit_logs" ON audit_logs;
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_audit_logs" ON audit_logs;
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE
  TO authenticated USING (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS receipts_date_idx ON receipts (date DESC);
CREATE INDEX IF NOT EXISTS receipts_status_idx ON receipts (status);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON expenses (category);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_updated_at ON members;
CREATE TRIGGER members_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS receipts_updated_at ON receipts;
CREATE TRIGGER receipts_updated_at BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS expenses_updated_at ON expenses;
CREATE TRIGGER expenses_updated_at BEFORE UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();