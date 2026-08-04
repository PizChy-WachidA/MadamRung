import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2, Camera, Link2, Link2Off } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatCurrency, formatDate, todayStr, monthStart, monthEnd } from '@/lib/utils';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { BankIncomeRecord, BankAccount, SaleRecord } from '@/types';

interface FormState {
  date: string; time_of_transfer: string; amount: string;
  sender_name: string; sender_account: string; reference_no: string; description: string;
}

const defaultForm: FormState = { date: todayStr(), time_of_transfer: '', amount: '', sender_name: '', sender_account: '', reference_no: '', description: '' };

export default function BankIncome() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [records, setRecords] = useState<BankIncomeRecord[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [matchingRecord, setMatchingRecord] = useState<string | null>(null);
  const [salesForMatch, setSalesForMatch] = useState<SaleRecord[]>([]);
  const slipRef = useRef<HTMLInputElement>(null);

  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: recs }, { data: accs }, { data: todayRecs }, { data: monthRecs }] = await Promise.all([
      supabase.from('bank_income_records').select('*, bank_accounts(*)').eq('user_id', user.id).order('date', { ascending: false }).order('created_at', { ascending: false }).limit(50),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('is_primary', { ascending: false }),
      supabase.from('bank_income_records').select('amount').eq('user_id', user.id).eq('date', todayStr()),
      supabase.from('bank_income_records').select('amount').eq('user_id', user.id).gte('date', monthStart()).lte('date', monthEnd()),
    ]);
    setRecords((recs || []) as BankIncomeRecord[]);
    setAccounts((accs || []) as BankAccount[]);
    if (accs && accs.length > 0) setSelectedAccountId(accs.find(a => a.is_primary)?.id || accs[0].id);
    setTodayTotal((todayRecs || []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0));
    setMonthTotal((monthRecs || []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const setField = (k: keyof FormState, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSlipSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSlipFile(f);
    const reader = new FileReader();
    reader.onload = () => setSlipPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleOCRSlip = async () => {
    if (!slipPreview || !user) return;
    setOcrLoading(true);
    toast.loading('AI กำลังอ่านสลิป...', { id: 'slip-ocr' });

    const { data: job } = await supabase.from('ocr_jobs').insert({
      user_id: user.id, image_url: slipPreview, ocr_type: 'slip', status: 'pending'
    }).select().single();

    if (!job) { toast.error('สร้าง OCR job ไม่สำเร็จ', { id: 'slip-ocr' }); setOcrLoading(false); return; }

    const { data: result, error } = await supabase.functions.invoke('ocr-scan', {
      body: { jobId: job.id, imageUrl: slipPreview, ocrType: 'slip', imageBase64: slipPreview },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context.text(); } catch {} }
      toast.error(`OCR ล้มเหลว: ${msg}`, { id: 'slip-ocr' });
      setOcrLoading(false); return;
    }

    const pd = result?.parsed_data || {};
    setField('amount', String(pd.amount || ''));
    if (pd.sender_name) setField('sender_name', pd.sender_name);
    if (pd.reference_no) setField('reference_no', pd.reference_no);
    if (pd.time) setField('time_of_transfer', pd.time);
    if (pd.date) setField('date', pd.date);
    await supabase.from('ocr_jobs').update({ status: 'approved' }).eq('id', job.id);
    toast.success('AI อ่านสลิปแล้ว ตรวจสอบข้อมูลด้วยนะคะ', { id: 'slip-ocr' });
    setOcrLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.amount || Number(form.amount) <= 0) { toast.error('กรุณากรอกจำนวนเงิน'); return; }

    setSaving(true);
    let slipUrl = '';
    if (slipFile) {
      const path = `${user.id}/slip-${Date.now()}.jpg`;
      const { data } = await supabase.storage.from('bank-slips').upload(path, slipFile);
      if (data) slipUrl = supabase.storage.from('bank-slips').getPublicUrl(data.path).data.publicUrl;
    }

    const { error } = await supabase.from('bank_income_records').insert({
      user_id: user.id, date: form.date,
      time_of_transfer: form.time_of_transfer || null,
      bank_account_id: selectedAccountId || null,
      sender_name: form.sender_name || null, sender_account: form.sender_account || null,
      amount: Number(form.amount), description: form.description || null,
      reference_no: form.reference_no || null,
      slip_image_url: slipUrl || null, source: 'manual',
    });

    setSaving(false);
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return; }
    toast.success('บันทึกรายรับแล้ว');
    setForm(prev => ({ ...defaultForm, date: prev.date }));
    setSlipFile(null); setSlipPreview(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('bank_income_records').delete().eq('id', id);
    setRecords(prev => prev.filter(r => r.id !== id));
    toast.success('ลบรายการแล้ว');
  };

  const handleStartMatch = async (recordId: string, date: string) => {
    setMatchingRecord(recordId);
    const { data } = await supabase.from('sales_records').select('*').eq('user_id', user!.id).eq('date', date).order('total_price', { ascending: false });
    setSalesForMatch((data || []) as SaleRecord[]);
  };

  const handleMatch = async (bankId: string, saleId: string) => {
    await supabase.from('bank_income_records').update({ is_matched: true, matched_sale_id: saleId }).eq('id', bankId);
    setRecords(prev => prev.map(r => r.id === bankId ? { ...r, is_matched: true, matched_sale_id: saleId } : r));
    setMatchingRecord(null);
    toast.success('จับคู่รายการแล้ว');
  };

  const primaryAccount = accounts.find(a => a.is_primary) || accounts[0];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">รายรับบัญชี</h1>
        {primaryAccount && <p className="text-xs text-[#737373]">{primaryAccount.bank_name} {primaryAccount.account_number}</p>}
      </div>

      <div className="page-content">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-card text-center">
            <p className="text-xs text-[#737373]">รับโอนวันนี้</p>
            <p className="text-xl font-bold text-[#16a34a]">{formatCurrency(todayTotal)}</p>
          </div>
          <div className="metric-card text-center">
            <p className="text-xs text-[#737373]">รับโอนเดือนนี้</p>
            <p className="text-xl font-bold text-[#16a34a]">{formatCurrency(monthTotal)}</p>
          </div>
        </div>

        {/* Form */}
        <div className="card-base space-y-3">
          <p className="section-title">บันทึกรายรับ</p>

          {accounts.length > 0 && (
            <div>
              <label className="label-base">บัญชีธนาคาร</label>
              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="input-base">
                {accounts.map(a => <option key={a.id} value={a.id}>{a.bank_name} {a.account_number} ({a.account_name})</option>)}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">วันที่โอน</label>
              <input type="date" value={form.date} onChange={e => setField('date', e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">เวลาโอน</label>
              <input type="time" value={form.time_of_transfer} onChange={e => setField('time_of_transfer', e.target.value)} className="input-base" />
            </div>
          </div>

          <div>
            <label className="label-base">จำนวนเงิน (฿)</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0.00" className="input-base" />
          </div>

          <div>
            <label className="label-base">ชื่อผู้โอน</label>
            <input type="text" value={form.sender_name} onChange={e => setField('sender_name', e.target.value)} placeholder="ชื่อผู้โอน (ไม่บังคับ)" className="input-base" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">เลขบัญชีผู้โอน</label>
              <input type="text" value={form.sender_account} onChange={e => setField('sender_account', e.target.value)} placeholder="xxx-xxx-xxxx" className="input-base" />
            </div>
            <div>
              <label className="label-base">เลขอ้างอิง</label>
              <input type="text" value={form.reference_no} onChange={e => setField('reference_no', e.target.value)} placeholder="REF..." className="input-base" />
            </div>
          </div>

          <div>
            <label className="label-base">หมายเหตุ</label>
            <input type="text" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="หมายเหตุ" className="input-base" />
          </div>

          {/* Slip OCR */}
          <div>
            <label className="label-base">อัปโหลดรูปสลิป (ให้ AI อ่าน)</label>
            {slipPreview ? (
              <div className="space-y-2">
                <img src={slipPreview} alt="slip" className="w-full max-h-48 object-contain rounded-lg border border-[#e5e5e5]" />
                <div className="flex gap-2">
                  <button onClick={handleOCRSlip} disabled={ocrLoading} className="btn-primary flex-1">
                    {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {ocrLoading ? 'AI กำลังอ่าน...' : 'ให้ AI อ่านสลิป'}
                  </button>
                  <button onClick={() => { setSlipFile(null); setSlipPreview(null); }} className="btn-secondary px-3">ลบ</button>
                </div>
              </div>
            ) : (
              <button onClick={() => slipRef.current?.click()} className="btn-secondary w-full">
                <Camera size={16} />ถ่ายรูปหรืออัปโหลดสลิป
              </button>
            )}
            <input ref={slipRef} type="file" accept="image/*" onChange={handleSlipSelect} className="hidden" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกรายรับ'}
          </button>
        </div>

        {/* Match modal */}
        {matchingRecord && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-end">
            <div className="bg-white w-full max-h-[60vh] overflow-y-auto rounded-t-2xl p-4">
              <p className="section-title mb-3">เลือกรายการขายที่ตรงกัน</p>
              {salesForMatch.length === 0 ? (
                <p className="text-sm text-[#a3a3a3] py-4 text-center">ไม่มีรายการขายในวันนี้</p>
              ) : salesForMatch.map(s => (
                <button key={s.id} onClick={() => handleMatch(matchingRecord, s.id)}
                  className="w-full text-left p-3 border border-[#e5e5e5] rounded-xl mb-2 hover:bg-[#f5f5f5]">
                  <p className="text-sm font-medium">{s.item_name}</p>
                  <p className="text-xs text-[#737373]">{formatCurrency(s.total_price)} · {s.quantity} ชิ้น</p>
                </button>
              ))}
              <button onClick={() => setMatchingRecord(null)} className="btn-secondary w-full mt-2">ยกเลิก</button>
            </div>
          </div>
        )}

        {/* Records list */}
        <div className="card-base">
          <p className="section-title mb-3">รายการรับโอนล่าสุด</p>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-14 bg-[#f5f5f5] rounded-lg animate-pulse"/>)}</div>
          ) : records.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] text-center py-6">ยังไม่มีรายการรับโอน</p>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-[#f5f5f5] hover:bg-[#fafafa]">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#16a34a]">{formatCurrency(r.amount)}</p>
                      <span className={r.is_matched ? 'badge-success' : 'badge-warning'}>{r.is_matched ? 'จับคู่แล้ว' : 'ยังไม่จับคู่'}</span>
                    </div>
                    <p className="text-xs text-[#737373]">
                      {formatDate(r.date)}{r.time_of_transfer ? ` ${r.time_of_transfer}` : ''}{r.sender_name ? ` · ${r.sender_name}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!r.is_matched && (
                      <button onClick={() => handleStartMatch(r.id, r.date)} className="p-2 hover:bg-[#f5f5f5] rounded-lg text-[#2563eb]" title="จับคู่">
                        <Link2 size={15} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(r.id)} className="p-2 hover:bg-red-50 rounded-lg text-[#dc2626]">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
