import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Camera, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatCurrency, formatDate, todayStr, monthStart, monthEnd, getPaymentStatusBadge } from '@/lib/utils';
import { FunctionsHttpError } from '@supabase/supabase-js';
import type { PurchaseBill, PurchaseBillItem, Supplier } from '@/types';

interface BillItemForm { item_name: string; quantity: string; unit_price: string; total_price: string; }
const defaultItem = (): BillItemForm => ({ item_name: '', quantity: '1', unit_price: '', total_price: '' });

export default function PurchaseBills() {
  const { user } = useAuth();
  const [bills, setBills] = useState<PurchaseBill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [todayTotal, setTodayTotal] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [expandedBill, setExpandedBill] = useState<string | null>(null);

  const [billDate, setBillDate] = useState(todayStr());
  const [supplierId, setSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<BillItemForm[]>([defaultItem()]);
  const [discount, setDiscount] = useState('0');
  const [taxAmount, setTaxAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('เงินสด');
  const [paymentStatus, setPaymentStatus] = useState('จ่ายแล้ว');
  const [notes, setNotes] = useState('');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [billPreview, setBillPreview] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const billRef = useRef<HTMLInputElement>(null);

  const totalAmount = items.reduce((s, i) => s + (Number(i.total_price) || Number(i.quantity) * Number(i.unit_price) || 0), 0);
  const netAmount = Math.max(0, totalAmount - Number(discount) - Number(taxAmount));

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: b }, { data: s }, { data: td }, { data: md }] = await Promise.all([
      supabase.from('purchase_bills').select('*, suppliers(*), purchase_bill_items(*)').eq('user_id', user.id).order('bill_date', { ascending: false }).limit(50),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
      supabase.from('purchase_bills').select('net_amount').eq('user_id', user.id).eq('bill_date', todayStr()),
      supabase.from('purchase_bills').select('net_amount').eq('user_id', user.id).gte('bill_date', monthStart()).lte('bill_date', monthEnd()),
    ]);
    setBills((b || []) as PurchaseBill[]);
    setSuppliers((s || []) as Supplier[]);
    setTodayTotal((td || []).reduce((sum: number, r: { net_amount: number }) => sum + Number(r.net_amount), 0));
    setMonthTotal((md || []).reduce((sum: number, r: { net_amount: number }) => sum + Number(r.net_amount), 0));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const updateItem = (idx: number, field: keyof BillItemForm, val: string) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: val };
      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(field === 'quantity' ? val : updated.quantity) || 0;
        const p = Number(field === 'unit_price' ? val : updated.unit_price) || 0;
        updated.total_price = q > 0 && p > 0 ? String(q * p) : updated.total_price;
      }
      return updated;
    }));
  };

  const handleBillSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBillFile(f);
    const reader = new FileReader();
    reader.onload = () => setBillPreview(reader.result as string);
    reader.readAsDataURL(f);
  };

  const handleOCRBill = async () => {
    if (!billPreview || !user) return;
    setOcrLoading(true);
    toast.loading('AI กำลังอ่านบิล...', { id: 'bill-ocr' });

    const { data: job } = await supabase.from('ocr_jobs').insert({
      user_id: user.id, image_url: billPreview, ocr_type: 'bill', status: 'pending'
    }).select().single();

    if (!job) { toast.error('สร้าง OCR job ไม่สำเร็จ', { id: 'bill-ocr' }); setOcrLoading(false); return; }

    const { data: result, error } = await supabase.functions.invoke('ocr-scan', {
      body: { jobId: job.id, imageUrl: billPreview, ocrType: 'bill', imageBase64: billPreview },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) { try { msg = await error.context.text(); } catch {} }
      toast.error(`OCR ล้มเหลว: ${msg}`, { id: 'bill-ocr' });
      setOcrLoading(false); return;
    }

    const pd = result?.parsed_data || {};
    if (pd.date) setBillDate(pd.date);
    if (pd.bill_number) setBillNumber(pd.bill_number);
    if (pd.supplier_name) setSupplierName(pd.supplier_name);
    if (pd.items && pd.items.length > 0) {
      setItems(pd.items.map((i: PurchaseBillItem) => ({
        item_name: i.item_name || '', quantity: String(i.quantity || 1),
        unit_price: String(i.unit_price || 0), total_price: String(i.total_price || 0),
      })));
    }
    await supabase.from('ocr_jobs').update({ status: 'approved' }).eq('id', job.id);
    toast.success('AI อ่านบิลแล้ว ตรวจสอบข้อมูลด้วยนะคะ', { id: 'bill-ocr' });
    setOcrLoading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    const validItems = items.filter(i => i.item_name.trim());
    if (validItems.length === 0) { toast.error('กรุณากรอกรายการสินค้าอย่างน้อย 1 รายการ'); return; }

    setSaving(true);
    let billUrl = '';
    if (billFile) {
      const path = `${user.id}/bill-${Date.now()}.jpg`;
      const { data } = await supabase.storage.from('bill-images').upload(path, billFile);
      if (data) billUrl = supabase.storage.from('bill-images').getPublicUrl(data.path).data.publicUrl;
    }

    // Upsert supplier
    let finalSupplierId = supplierId;
    if (!finalSupplierId && supplierName.trim()) {
      const { data: s } = await supabase.from('suppliers').insert({ user_id: user.id, name: supplierName.trim() }).select().single();
      if (s) finalSupplierId = s.id;
    }

    const tAmt = validItems.reduce((s, i) => s + (Number(i.total_price) || Number(i.quantity) * Number(i.unit_price) || 0), 0);
    const nAmt = Math.max(0, tAmt - Number(discount) - Number(taxAmount));

    const { data: bill, error } = await supabase.from('purchase_bills').insert({
      user_id: user.id, bill_date: billDate, supplier_id: finalSupplierId || null, bill_number: billNumber || null,
      total_amount: tAmt, discount: Number(discount), tax_amount: Number(taxAmount), net_amount: nAmt,
      payment_method: paymentMethod, payment_status: paymentStatus, notes: notes || null,
      bill_image_url: billUrl || null, source: 'manual',
    }).select().single();

    if (error || !bill) { toast.error('บันทึกบิลไม่สำเร็จ'); setSaving(false); return; }

    const billItems = validItems.map(i => ({
      purchase_bill_id: bill.id,
      item_name: i.item_name.trim(),
      quantity: Number(i.quantity) || 1,
      unit_price: Number(i.unit_price) || 0,
      total_price: Number(i.total_price) || (Number(i.quantity) * Number(i.unit_price)),
    }));
    await supabase.from('purchase_bill_items').insert(billItems);

    setSaving(false);
    toast.success('บันทึกบิลแล้ว');
    setBillDate(todayStr()); setSupplierId(''); setSupplierName(''); setBillNumber('');
    setItems([defaultItem()]); setDiscount('0'); setTaxAmount('0'); setNotes('');
    setPaymentMethod('เงินสด'); setPaymentStatus('จ่ายแล้ว');
    setBillFile(null); setBillPreview(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('purchase_bills').delete().eq('id', id);
    setBills(prev => prev.filter(b => b.id !== id));
    toast.success('ลบบิลแล้ว');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">บิลซื้อของ</h1>
        <p className="text-xs text-[#737373]">บันทึกบิลและใบเสร็จจากคนขายส่ง</p>
      </div>

      <div className="page-content">
        <div className="grid grid-cols-2 gap-3">
          <div className="metric-card text-center"><p className="text-xs text-[#737373]">ซื้อวันนี้</p><p className="text-xl font-bold text-[#dc2626]">{formatCurrency(todayTotal)}</p></div>
          <div className="metric-card text-center"><p className="text-xs text-[#737373]">ซื้อเดือนนี้</p><p className="text-xl font-bold text-[#dc2626]">{formatCurrency(monthTotal)}</p></div>
        </div>

        <div className="card-base space-y-3">
          <p className="section-title">กรอกบิลใหม่</p>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-base">วันที่บิล</label><input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="input-base" /></div>
            <div><label className="label-base">เลขที่บิล</label><input type="text" value={billNumber} onChange={e => setBillNumber(e.target.value)} placeholder="BILL001" className="input-base" /></div>
          </div>

          <div>
            <label className="label-base">คนขายส่ง</label>
            <select value={supplierId} onChange={e => { setSupplierId(e.target.value); setSupplierName(''); }} className="input-base mb-2">
              <option value="">-- เลือกหรือพิมพ์ชื่อใหม่ --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {!supplierId && <input type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="ชื่อคนขายส่ง (ถ้าไม่มีในรายการ)" className="input-base" />}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="label-base mb-0">รายการสินค้า</label>
              <button onClick={() => setItems(prev => [...prev, defaultItem()])} className="text-xs text-[#2563eb] font-medium flex items-center gap-1"><Plus size={12} />เพิ่มแถว</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 bg-[#fafafa] border border-[#e5e5e5] rounded-xl">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs text-[#737373]">รายการ {idx + 1}</span>
                    {items.length > 1 && <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-[#dc2626]"><Trash2 size={13} /></button>}
                  </div>
                  <input type="text" value={item.item_name} onChange={e => updateItem(idx, 'item_name', e.target.value)} placeholder="ชื่อสินค้า" className="input-base text-sm mb-2" />
                  <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-xs text-[#737373]">จำนวน</label><input type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="input-base text-sm" /></div>
                    <div><label className="text-xs text-[#737373]">ราคา/หน่วย</label><input type="number" min="0" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} className="input-base text-sm" /></div>
                    <div><label className="text-xs text-[#737373]">รวม</label><input type="number" min="0" value={item.total_price} onChange={e => updateItem(idx, 'total_price', e.target.value)} className="input-base text-sm" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-base">ส่วนลด</label><input type="number" min="0" value={discount} onChange={e => setDiscount(e.target.value)} className="input-base" /></div>
            <div><label className="label-base">ภาษี</label><input type="number" min="0" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} className="input-base" /></div>
          </div>

          <div className="p-3 bg-[#f5f5f5] rounded-xl flex justify-between">
            <span className="text-sm font-medium">ยอดสุทธิ</span>
            <span className="text-lg font-bold text-[#1a1a1a]">{formatCurrency(netAmount)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">วิธีการจ่าย</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="input-base">
                {['เงินสด', 'โอน', 'เครดิต'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label-base">สถานะจ่าย</label>
              <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} className="input-base">
                {['จ่ายแล้ว', 'ยังไม่จ่าย', 'จ่ายบางส่วน'].map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div><label className="label-base">หมายเหตุ</label><input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="หมายเหตุ" className="input-base" /></div>

          <div>
            <label className="label-base">รูปบิล/ใบเสร็จ (ให้ AI อ่าน)</label>
            {billPreview ? (
              <div className="space-y-2">
                <img src={billPreview} alt="bill" className="w-full max-h-48 object-contain rounded-lg border border-[#e5e5e5]" />
                <div className="flex gap-2">
                  <button onClick={handleOCRBill} disabled={ocrLoading} className="btn-primary flex-1">
                    {ocrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {ocrLoading ? 'AI กำลังอ่าน...' : 'ให้ AI อ่านบิล'}
                  </button>
                  <button onClick={() => { setBillFile(null); setBillPreview(null); }} className="btn-secondary px-3">ลบ</button>
                </div>
              </div>
            ) : (
              <button onClick={() => billRef.current?.click()} className="btn-secondary w-full"><Camera size={16} />ถ่ายรูปหรืออัปโหลดบิล</button>
            )}
            <input ref={billRef} type="file" accept="image/*" onChange={handleBillSelect} className="hidden" />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกบิล'}
          </button>
        </div>

        <div className="card-base">
          <p className="section-title mb-3">บิลล่าสุด</p>
          {loading ? (
            <div className="space-y-2">{[...Array(4)].map((_,i) => <div key={i} className="h-14 bg-[#f5f5f5] rounded-lg animate-pulse"/>)}</div>
          ) : bills.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] text-center py-6">ยังไม่มีบิล</p>
          ) : (
            <div className="space-y-2">
              {bills.map(bill => (
                <div key={bill.id} className="border border-[#e5e5e5] rounded-xl overflow-hidden">
                  <div className="flex items-center p-3 cursor-pointer hover:bg-[#fafafa]" onClick={() => setExpandedBill(expandedBill === bill.id ? null : bill.id)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{formatCurrency(bill.net_amount)}</p>
                        <span className={getPaymentStatusBadge(bill.payment_status)}>{bill.payment_status}</span>
                      </div>
                      <p className="text-xs text-[#737373]">
                        {formatDate(bill.bill_date)}{bill.suppliers?.name ? ` · ${bill.suppliers.name}` : ''}{bill.bill_number ? ` · ${bill.bill_number}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(bill.id); }} className="p-2 text-[#dc2626] hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      {expandedBill === bill.id ? <ChevronUp size={16} className="text-[#737373]" /> : <ChevronDown size={16} className="text-[#737373]" />}
                    </div>
                  </div>
                  {expandedBill === bill.id && bill.purchase_bill_items && (
                    <div className="border-t border-[#f5f5f5] px-3 pb-3">
                      {bill.purchase_bill_items.map((item, i) => (
                        <div key={i} className="flex justify-between py-1.5 text-sm border-b border-[#f5f5f5] last:border-0">
                          <span className="text-[#525252]">{item.item_name} × {item.quantity}</span>
                          <span className="font-medium">{formatCurrency(item.total_price)}</span>
                        </div>
                      ))}
                    </div>
                  )}
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
