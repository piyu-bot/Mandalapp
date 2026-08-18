import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase, type Receipt } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { logAudit } from '@/lib/audit';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { formatCurrency, formatDate, generateReceiptNumber, todayISO } from '@/lib/utils';
import { Printer, Share2, CheckCircle2, FilePlus2, Loader2 } from '@/components/icons';

const schema = z.object({
  receipt_number: z.string().min(1, 'Receipt number is required'),
  date: z.string().min(1, 'Date is required'),
  donor_name: z.string().min(1, 'Name is required'),
  mobile: z.string().optional(),
  address: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be positive'),
  paid_amount: z.coerce.number().min(0, 'Paid amount cannot be negative'),
  payment_method: z.enum(['Cash', 'UPI', 'Bank Transfer', 'Other']),
  purpose: z.string().optional(),
  collected_by: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['Paid', 'Pending', 'Partially Paid', 'Overdue']),
});

type FormData = z.infer<typeof schema>;

export default function NewReceipt() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [savedReceipt, setSavedReceipt] = useState<Receipt | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      receipt_number: generateReceiptNumber(),
      date: todayISO(),
      payment_method: 'Cash',
      status: 'Paid',
      paid_amount: 0,
    },
  });

  const amount = watch('amount');
  const status = watch('status');

  // Auto-set paid_amount based on status
  const onStatusChange = (val: FormData['status']) => {
    setValue('status', val);
    if (val === 'Paid') setValue('paid_amount', amount || 0);
    if (val === 'Pending') setValue('paid_amount', 0);
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    try {
      // Check duplicate receipt number
      const { data: existing } = await supabase
        .from('receipts')
        .select('id')
        .eq('receipt_number', data.receipt_number)
        .maybeSingle();
      if (existing) {
        toast('Receipt number already exists. Generating a new one.', 'warning');
        const newNum = generateReceiptNumber();
        setValue('receipt_number', newNum);
        setSaving(false);
        return;
      }

      const paidAmount = data.status === 'Paid' ? data.amount : data.paid_amount;

      const { data: inserted, error } = await supabase
        .from('receipts')
        .insert({
          receipt_number: data.receipt_number,
          date: data.date,
          donor_name: data.donor_name,
          mobile: data.mobile || null,
          address: data.address || null,
          amount: data.amount,
          paid_amount: paidAmount,
          payment_method: data.payment_method,
          purpose: data.purpose || null,
          collected_by: data.collected_by || null,
          notes: data.notes || null,
          status: data.status,
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit({
        action: 'Receipt Added',
        record_id: data.receipt_number,
        record_type: 'receipt',
        new_value: { ...data, paid_amount: paidAmount } as Record<string, unknown>,
      });

      toast('Receipt saved successfully!', 'success');
      setSavedReceipt(inserted as Receipt);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to save receipt', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (receipt: Receipt) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast('Please allow popups to print the receipt', 'warning');
      return;
    }
    printWindow.document.write(`
      <!doctype html><html><head><title>Receipt ${receipt.receipt_number}</title>
      <style>
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        body { margin: 0; padding: 40px; background: #f4f4f5; }
        .receipt { max-width: 600px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ea580c, #d97706); color: white; padding: 32px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; }
        .header p { margin: 4px 0 0; font-size: 14px; opacity: 0.9; }
        .body { padding: 32px; }
        .row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
        .row:last-child { border: none; }
        .label { color: #71717a; font-size: 13px; }
        .value { font-weight: 600; color: #18181b; font-size: 14px; }
        .amount-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
        .amount-box .label { font-size: 12px; }
        .amount-box .amount { font-size: 28px; font-weight: bold; color: #059669; }
        .footer { text-align: center; padding: 20px 32px 32px; color: #71717a; font-size: 12px; }
        .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; }
      </style></head><body>
      <div class="receipt">
        <div class="header">
          <h1>अष्टविनायक गणेशोत्सव मंडळ</h1>
          <p>Official Donation Receipt</p>
        </div>
        <div class="body">
          <div class="row"><span class="label">Receipt No</span><span class="value">${receipt.receipt_number}</span></div>
          <div class="row"><span class="label">Date</span><span class="value">${formatDate(receipt.date)}</span></div>
          <div class="row"><span class="label">Name</span><span class="value">${receipt.donor_name}</span></div>
          <div class="row"><span class="label">Mobile</span><span class="value">${receipt.mobile ?? '-'}</span></div>
          <div class="row"><span class="label">Payment Method</span><span class="value">${receipt.payment_method}</span></div>
          <div class="row"><span class="label">Purpose</span><span class="value">${receipt.purpose ?? '-'}</span></div>
          <div class="row"><span class="label">Collected By</span><span class="value">${receipt.collected_by ?? '-'}</span></div>
          <div class="row"><span class="label">Status</span><span class="value"><span class="badge">${receipt.status}</span></span></div>
          <div class="amount-box">
            <div class="label">Amount</div>
            <div class="amount">${formatCurrency(Number(receipt.amount))}</div>
            ${receipt.status !== 'Paid' ? `<div class="label" style="margin-top:8px">Paid: ${formatCurrency(Number(receipt.paid_amount))}</div>` : ''}
          </div>
          ${receipt.notes ? `<div class="row"><span class="label">Notes</span><span class="value">${receipt.notes}</span></div>` : ''}
        </div>
        <div class="footer">
          <p>Thank you for your generous contribution!</p>
          <p>अष्टविनायक गणेशोत्सव मंडळ · Generated on ${formatDate(new Date())}</p>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleWhatsApp = (receipt: Receipt) => {
    const msg = `*अष्टविनायक गणेशोत्सव मंडळ*\n\n*Receipt No:* ${receipt.receipt_number}\n*Name:* ${receipt.donor_name}\n*Amount:* ${formatCurrency(Number(receipt.amount))}\n*Date:* ${formatDate(receipt.date)}\n*Payment Method:* ${receipt.payment_method}\n*Status:* ${receipt.status}\n\nThank you for your generous contribution! 🙏\n- अष्टविनायक गणेशोत्सव मंडळ`;
    const phone = (receipt.mobile ?? '').replace(/\D/g, '');
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  const inputClass = 'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-orange-500/50 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors';
  const labelClass = 'block text-sm font-medium text-zinc-300 mb-1.5';

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader title="New Add Receipt" subtitle="Create a new donation receipt" />
        <CardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Receipt Number *</label>
                <input {...register('receipt_number')} className={inputClass} />
                {errors.receipt_number && <p className="mt-1 text-xs text-red-400">{errors.receipt_number.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Date *</label>
                <input type="date" {...register('date')} className={inputClass} />
                {errors.date && <p className="mt-1 text-xs text-red-400">{errors.date.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Member/Donor Name *</label>
                <input {...register('donor_name')} className={inputClass} placeholder="Enter name" />
                {errors.donor_name && <p className="mt-1 text-xs text-red-400">{errors.donor_name.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Mobile Number</label>
                <input {...register('mobile')} className={inputClass} placeholder="98XXXXXXXX" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Address</label>
              <input {...register('address')} className={inputClass} placeholder="Enter address" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Amount *</label>
                <input type="number" step="0.01" {...register('amount')} className={inputClass} placeholder="0" />
                {errors.amount && <p className="mt-1 text-xs text-red-400">{errors.amount.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Paid Amount</label>
                <input type="number" step="0.01" {...register('paid_amount')} className={inputClass} placeholder="0" />
                {errors.paid_amount && <p className="mt-1 text-xs text-red-400">{errors.paid_amount.message}</p>}
              </div>
              <div>
                <label className={labelClass}>Payment Method *</label>
                <select {...register('payment_method')} className={inputClass}>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Purpose</label>
                <input {...register('purpose')} className={inputClass} placeholder="Donation purpose" />
              </div>
              <div>
                <label className={labelClass}>Collected By</label>
                <input {...register('collected_by')} className={inputClass} placeholder="Collector name" />
              </div>
            </div>

            <div>
              <label className={labelClass}>Receipt Status</label>
              <div className="flex flex-wrap gap-2">
                {(['Paid', 'Pending', 'Partially Paid', 'Overdue'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onStatusChange(s)}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${status === s ? 'border-orange-500 bg-orange-500/15 text-orange-300' : 'border-white/10 bg-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Notes</label>
              <textarea {...register('notes')} rows={2} className={inputClass} placeholder="Additional notes" />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 hover:from-orange-500 hover:to-amber-500 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}
              {saving ? 'Saving...' : 'Save Receipt'}
            </button>
          </form>
        </CardBody>
      </Card>

      {/* Success Modal */}
      <Modal open={!!savedReceipt} onClose={() => setSavedReceipt(null)} title="Receipt Saved" size="sm">
        {savedReceipt && (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 mb-3">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold text-white">Receipt Created</h3>
              <p className="text-sm text-zinc-400 mt-1">{savedReceipt.receipt_number}</p>
              <div className="mt-3 flex items-center gap-2">
                <Badge label={savedReceipt.status} />
                <span className="text-lg font-bold text-emerald-400">{formatCurrency(Number(savedReceipt.amount))}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handlePrint(savedReceipt)}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition-colors"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => handleWhatsApp(savedReceipt)}
                className="flex items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2.5 text-sm font-medium text-emerald-300 hover:bg-emerald-500/20 transition-colors"
              >
                <Share2 className="h-4 w-4" /> WhatsApp
              </button>
            </div>
            <button
              onClick={() => { setSavedReceipt(null); navigate('/'); }}
              className="w-full rounded-lg py-2.5 text-sm font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
