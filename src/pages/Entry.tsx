import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatCurrency, todayStr, formatDate } from '@/lib/utils';
import type { SaleRecord, ProductCategory } from '@/types';

interface FormState {
  date: string;
  item_name: string;
  quantity: string;
  unit_price: string;
  total_price: string;
  category: string;
  notes: string;
}

const defaultForm: FormState = {
  date: todayStr(),
  item_name: '',
  quantity: '1',
  unit_price: '',
  total_price: '',
  category: '',
  notes: '',
};

export default function Entry() {
  const { user } = useAuth();
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [todayRecords, setTodayRecords] = useState<SaleRecord[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingRecords, setLoadingRecords] = useState(true);

  const fetchTodayRecords = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('sales_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', form.date)
      .order('created_at', { ascending: false });
    setTodayRecords((data || []) as SaleRecord[]);
    setLoadingRecords(false);
  }, [user, form.date]);

  const fetchCategories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('product_categories').select('*').eq('user_id', user.id).order('name');
    setCategories((data || []) as ProductCategory[]);
  }, [user]);

  useEffect(() => {
    fetchTodayRecords();
    fetchCategories();
  }, [fetchTodayRecords, fetchCategories]);

  const setField = (field: keyof FormState, val: string) => {
    setForm(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'quantity' || field === 'unit_price') {
        const q = Number(field === 'quantity' ? val : next.quantity) || 0;
        const p = Number(field === 'unit_price' ? val : next.unit_price) || 0;
        next.total_price = q > 0 && p > 0 ? String(q * p) : next.total_price;
      }
      return next;
    });
  };

  const handleItemNameChange = async (val: string) => {
    setField('item_name', val);
    if (val.length >= 2 && user) {
      const { data } = await supabase
        .from('sales_records')
        .select('item_name')
        .eq('user_id', user.id)
        .ilike('item_name', `%${val}%`)
        .limit(5);
      const names = [...new Set((data || []).map(r => r.item_name))];
      setSuggestions(names);
      setShowSuggestions(names.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    if (!form.item_name.trim()) { toast.error('กรุณากรอกชื่อสินค้า'); return; }
    if (!form.unit_price || Number(form.unit_price) <= 0) { toast.error('กรุณากรอกราคาต่อชิ้น'); return; }
    if (!form.quantity || Number(form.quantity) < 1) { toast.error('กรุณากรอกจำนวน'); return; }

    const qty = Number(form.quantity);
    const price = Number(form.unit_price);
    const total = Number(form.total_price) || qty * price;

    setSaving(true);
    const { error } = await supabase.from('sales_records').insert({
      user_id: user.id,
      date: form.date,
      item_name: form.item_name.trim(),
      quantity: qty,
      unit_price: price,
      total_price: total,
      category: form.category || null,
      notes: form.notes || null,
      source: 'manual',
    });
    setSaving(false);

    if (error) { toast.error('บันทึกไม่สำเร็จ'); return; }
    toast.success('บันทึกรายการขายแล้ว');
    setForm(prev => ({ ...defaultForm, date: prev.date }));
    fetchTodayRecords();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('sales_records').delete().eq('id', id);
    setTodayRecords(prev => prev.filter(r => r.id !== id));
    toast.success('ลบรายการแล้ว');
  };

  const todayTotal = todayRecords.reduce((s, r) => s + Number(r.total_price), 0);

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">กรอกรายการขาย</h1>
        <p className="text-xs text-[#737373]">บันทึกยอดขายด้วยตนเอง</p>
      </div>

      <div className="page-content">
        <div className="card-base space-y-3">
          <div>
            <label className="label-base">วันที่</label>
            <input
              type="date" value={form.date}
              onChange={e => { setField('date', e.target.value); setLoadingRecords(true); }}
              className="input-base"
            />
          </div>

          <div className="relative">
            <label className="label-base">ชื่อสินค้า</label>
            <input
              type="text" value={form.item_name}
              onChange={e => handleItemNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="ชื่อสินค้า เช่น กระเป๋าหนังแท้ A"
              className="input-base"
            />
            {showSuggestions && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-[#e5e5e5] rounded-xl shadow-lg">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setField('item_name', s); setShowSuggestions(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-[#f5f5f5] first:rounded-t-xl last:rounded-b-xl"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="label-base">จำนวน</label>
              <input
                type="number" min="1" value={form.quantity}
                onChange={e => setField('quantity', e.target.value)}
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">ราคา/ชิ้น (฿)</label>
              <input
                type="number" min="0" step="0.01" value={form.unit_price}
                onChange={e => setField('unit_price', e.target.value)}
                placeholder="0.00"
                className="input-base"
              />
            </div>
            <div>
              <label className="label-base">รวม (฿)</label>
              <input
                type="number" min="0" step="0.01" value={form.total_price}
                onChange={e => setField('total_price', e.target.value)}
                placeholder="คำนวณอัตโนมัติ"
                className="input-base"
              />
            </div>
          </div>

          <div>
            <label className="label-base">หมวดหมู่</label>
            <select value={form.category} onChange={e => setField('category', e.target.value)} className="input-base">
              <option value="">-- เลือกหมวดหมู่ --</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label-base">หมายเหตุ (ไม่บังคับ)</label>
            <input
              type="text" value={form.notes}
              onChange={e => setField('notes', e.target.value)}
              placeholder="เพิ่มหมายเหตุ เช่น ลูกค้าประจำ"
              className="input-base"
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
            {saving ? 'กำลังบันทึก...' : 'บันทึกรายการขาย'}
          </button>
        </div>

        {/* Today summary */}
        <div className="card-base">
          <div className="flex items-center justify-between mb-3">
            <p className="section-title">รายการวันที่ {formatDate(form.date)}</p>
            <div className="text-right">
              <p className="text-xs text-[#737373]">ยอดรวม</p>
              <p className="text-lg font-bold text-[#1a1a1a]">{formatCurrency(todayTotal)}</p>
            </div>
          </div>

          {loadingRecords ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-[#f5f5f5] rounded-lg animate-pulse" />)}
            </div>
          ) : todayRecords.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] text-center py-4">ยังไม่มีรายการในวันนี้</p>
          ) : (
            <div className="space-y-1">
              {todayRecords.map((rec, idx) => (
                <div key={rec.id} className="flex items-center justify-between py-2 border-b border-[#f5f5f5] last:border-0">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs text-[#a3a3a3] w-5 flex-shrink-0">{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1a1a1a] truncate">{rec.item_name}</p>
                      <p className="text-xs text-[#a3a3a3]">
                        {rec.quantity} ชิ้น × {formatCurrency(rec.unit_price)}
                        {rec.category ? ` · ${rec.category}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <p className="text-sm font-semibold text-[#1a1a1a]">{formatCurrency(rec.total_price)}</p>
                    <button onClick={() => handleDelete(rec.id)} className="p-1 text-[#dc2626] hover:bg-red-50 rounded">
                      <Trash2 size={14} />
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
