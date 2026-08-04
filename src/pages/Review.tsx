import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Plus, Trash2, Save, X, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { todayStr, formatCurrency } from '@/lib/utils';
import type { OCRJob, OCREntry } from '@/types';

export default function Review() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [job, setJob] = useState<OCRJob | null>(null);
  const [entries, setEntries] = useState<OCREntry[]>([]);
  const [date, setDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      if (!jobId || !user) return;
      const { data } = await supabase.from('ocr_jobs').select('*').eq('id', jobId).eq('user_id', user.id).single();
      if (!data) { toast.error('ไม่พบรายการ'); navigate('/scan'); return; }
      const j = data as OCRJob;
      setJob(j);

      // Handle different OCR types
      if (j.ocr_type === 'notebook' && j.parsed_data?.entries) {
        setEntries(j.parsed_data.entries.map(e => ({
          item_name: e.item_name || '',
          quantity: Number(e.quantity) || 1,
          unit_price: Number(e.unit_price) || 0,
          total_price: Number(e.total_price) || (Number(e.quantity) * Number(e.unit_price)),
        })));
        if (j.parsed_data.date) setDate(j.parsed_data.date);
      } else if (j.ocr_type === 'slip' && j.parsed_data) {
        setEntries([{
          item_name: `รับโอน${j.parsed_data.sender_name ? ` จาก ${j.parsed_data.sender_name}` : ''}`,
          quantity: 1,
          unit_price: Number(j.parsed_data.amount) || 0,
          total_price: Number(j.parsed_data.amount) || 0,
        }]);
        if (j.parsed_data.date) setDate(j.parsed_data.date);
      } else if (j.ocr_type === 'bill' && j.parsed_data) {
        const items = j.parsed_data.items || j.parsed_data.entries || [];
        setEntries(items.map(e => ({
          item_name: e.item_name || '',
          quantity: Number(e.quantity) || 1,
          unit_price: Number(e.unit_price) || 0,
          total_price: Number(e.total_price) || 0,
        })));
        if (j.parsed_data.date) setDate(j.parsed_data.date);
      } else {
        setEntries([{ item_name: '', quantity: 1, unit_price: 0, total_price: 0 }]);
      }
      setLoading(false);
    };
    fetchJob();
  }, [jobId, user, navigate]);

  const updateEntry = (idx: number, field: keyof OCREntry, val: string | number) => {
    setEntries(prev => prev.map((e, i) => {
      if (i !== idx) return e;
      const updated = { ...e, [field]: val };
      if (field === 'quantity' || field === 'unit_price') {
        updated.total_price = Number(updated.quantity) * Number(updated.unit_price);
      }
      return updated;
    }));
  };

  const addEntry = () => setEntries(prev => [...prev, { item_name: '', quantity: 1, unit_price: 0, total_price: 0 }]);
  const removeEntry = (idx: number) => setEntries(prev => prev.filter((_, i) => i !== idx));

  const totalAmount = entries.reduce((s, e) => s + Number(e.total_price), 0);

  const handleSave = async () => {
    if (!user || !job) return;
    const validEntries = entries.filter(e => e.item_name.trim());
    if (validEntries.length === 0) { toast.error('กรุณากรอกชื่อสินค้าอย่างน้อย 1 รายการ'); return; }

    setSaving(true);

    if (job.ocr_type === 'slip') {
      // Save to bank_income_records
      const e = validEntries[0];
      const { error } = await supabase.from('bank_income_records').insert({
        user_id: user.id,
        date,
        amount: e.unit_price,
        sender_name: job.parsed_data?.sender_name || '',
        reference_no: job.parsed_data?.reference_no || '',
        time_of_transfer: job.parsed_data?.time || null,
        slip_image_url: job.image_url,
        source: 'slip_ocr',
      });
      if (error) { toast.error('บันทึกรายรับไม่สำเร็จ'); setSaving(false); return; }
    } else if (job.ocr_type === 'bill') {
      // Save to purchase_bills
      const totalAmt = validEntries.reduce((s, e) => s + Number(e.total_price), 0);
      const { data: bill, error: billError } = await supabase.from('purchase_bills').insert({
        user_id: user.id,
        bill_date: date,
        total_amount: totalAmt,
        net_amount: totalAmt,
        bill_image_url: job.image_url,
        source: 'bill_ocr',
      }).select().single();
      if (billError || !bill) { toast.error('บันทึกบิลไม่สำเร็จ'); setSaving(false); return; }
      const items = validEntries.map(e => ({
        purchase_bill_id: bill.id,
        item_name: e.item_name,
        quantity: e.quantity,
        unit_price: e.unit_price,
        total_price: e.total_price,
      }));
      await supabase.from('purchase_bill_items').insert(items);
    } else {
      // Save to sales_records
      const records = validEntries.map(e => ({
        user_id: user.id,
        date,
        item_name: e.item_name,
        quantity: Number(e.quantity),
        unit_price: Number(e.unit_price),
        total_price: Number(e.total_price) || Number(e.quantity) * Number(e.unit_price),
        source: 'ocr',
        ocr_job_id: job.id,
        image_url: job.image_url,
      }));
      const { error } = await supabase.from('sales_records').insert(records);
      if (error) { toast.error('บันทึกรายการขายไม่สำเร็จ'); setSaving(false); return; }
    }

    // Update job status
    await supabase.from('ocr_jobs').update({ status: 'approved' }).eq('id', job.id);
    toast.success('บันทึกข้อมูลเรียบร้อยแล้ว');
    navigate('/scan');
  };

  const handleReject = async () => {
    if (!job) return;
    await supabase.from('ocr_jobs').update({ status: 'rejected' }).eq('id', job.id);
    toast.success('ยกเลิกรายการแล้ว');
    navigate('/scan');
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="text-base font-semibold">ตรวจสอบข้อมูล OCR</h1></div>
        <div className="page-content">
          {[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-[#f5f5f5] rounded-xl animate-pulse" />)}
        </div>
        <BottomNav />
      </div>
    );
  }

  const typeLabel = job?.ocr_type === 'slip' ? 'สลิปโอนเงิน' : job?.ocr_type === 'bill' ? 'บิลซื้อของ' : 'สมุดขาย';

  return (
    <div className="page-container">
      <div className="page-header flex items-center gap-3">
        <button onClick={() => navigate('/scan')} className="p-1.5 rounded-full hover:bg-[#f5f5f5]">
          <ArrowLeft size={18} className="text-[#525252]" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-[#1a1a1a]">ตรวจสอบข้อมูล OCR</h1>
          <p className="text-xs text-[#737373]">แก้ไขข้อมูลที่ AI อ่านได้ก่อนบันทึก · {typeLabel}</p>
        </div>
      </div>

      <div className="page-content">
        {/* Preview + date */}
        <div className="card-base space-y-3">
          {job?.image_url && (
            <img src={job.image_url} alt="scanned" className="w-full max-h-48 object-contain rounded-lg border border-[#e5e5e5]" />
          )}
          <div>
            <label className="label-base">วันที่</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input-base" />
          </div>
        </div>

        {/* Entries table */}
        <div className="card-base">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">รายการสินค้า ({entries.length} รายการ)</p>
            <button onClick={addEntry} className="flex items-center gap-1 text-xs text-[#2563eb] font-medium">
              <Plus size={14} />เพิ่มรายการ
            </button>
          </div>

          <div className="space-y-3">
            {entries.map((entry, idx) => (
              <div key={idx} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#737373]">รายการที่ {idx + 1}</span>
                  {entries.length > 1 && (
                    <button onClick={() => removeEntry(idx)} className="p-1 text-[#dc2626] hover:bg-red-50 rounded">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={entry.item_name}
                    onChange={e => updateEntry(idx, 'item_name', e.target.value)}
                    placeholder="ชื่อสินค้า"
                    className="input-base text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-[#737373] mb-1 block">จำนวน</label>
                      <input
                        type="number" min="1" value={entry.quantity}
                        onChange={e => updateEntry(idx, 'quantity', Number(e.target.value))}
                        className="input-base text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#737373] mb-1 block">ราคา/ชิ้น</label>
                      <input
                        type="number" min="0" step="0.01" value={entry.unit_price}
                        onChange={e => updateEntry(idx, 'unit_price', Number(e.target.value))}
                        className="input-base text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-[#737373] mb-1 block">รวม</label>
                      <input
                        type="number" min="0" step="0.01" value={entry.total_price}
                        onChange={e => updateEntry(idx, 'total_price', Number(e.target.value))}
                        className="input-base text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 p-3 bg-[#f5f5f5] rounded-xl flex justify-between items-center">
            <span className="text-sm font-medium text-[#525252]">ยอดรวม</span>
            <span className="text-lg font-bold text-[#1a1a1a]">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-2">
          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกทั้งหมด'}
          </button>
          <button onClick={handleReject} disabled={saving} className="btn-danger w-full">
            <X size={16} />ยกเลิกรายการนี้
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
