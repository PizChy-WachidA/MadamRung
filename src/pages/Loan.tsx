import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Upload, Printer } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { monthStart, monthEnd, todayStr, formatDate, formatCurrency } from '@/lib/utils';
import type { LoanDocument, StoreSettings, SaleRecord } from '@/types';

export default function Loan() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<LoanDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('ชุดเอกสารขอสินเชื่อ');
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [periodEnd, setPeriodEnd] = useState(todayStr());
  const [storePhotoFile, setStorePhotoFile] = useState<File | null>(null);
  const [interiorPhotoFile, setInteriorPhotoFile] = useState<File | null>(null);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [previewData, setPreviewData] = useState<{ sales: SaleRecord[]; totalSales: number; totalBank: number } | null>(null);

  const fetchDocs = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('loan_documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setDocs((data || []) as LoanDocument[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDocs();
    if (user) {
      supabase.from('store_settings').select('*').eq('user_id', user.id).single()
        .then(({ data }) => {
          setSettings(data as StoreSettings || { id: '', user_id: user.id, store_name: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง', owner_name: 'นางสาวรุ่ง หังษาบุตร', phone: '081-383-0622', updated_at: '' });
        });
    }
  }, [user, fetchDocs]);

  const handlePreview = async () => {
    if (!user) return;
    const [{ data: sales }, { data: bank }] = await Promise.all([
      supabase.from('sales_records').select('*').eq('user_id', user.id).gte('date', periodStart).lte('date', periodEnd),
      supabase.from('bank_income_records').select('amount').eq('user_id', user.id).gte('date', periodStart).lte('date', periodEnd),
    ]);
    const totalSales = (sales || []).reduce((s: number, r: SaleRecord) => s + Number(r.total_price), 0);
    const totalBank = (bank || []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
    setPreviewData({ sales: (sales || []) as SaleRecord[], totalSales, totalBank });
  };

  const handleCreate = async () => {
    if (!user || !title.trim()) { toast.error('กรุณากรอกชื่อชุดเอกสาร'); return; }
    setCreating(true);

    let storePhotoUrl = '';
    let interiorPhotoUrl = '';

    if (storePhotoFile) {
      const { data } = await supabase.storage.from('store-assets').upload(`${user.id}/store-${Date.now()}.jpg`, storePhotoFile);
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(data.path);
        storePhotoUrl = publicUrl;
      }
    }
    if (interiorPhotoFile) {
      const { data } = await supabase.storage.from('store-assets').upload(`${user.id}/interior-${Date.now()}.jpg`, interiorPhotoFile);
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('store-assets').getPublicUrl(data.path);
        interiorPhotoUrl = publicUrl;
      }
    }

    const { error } = await supabase.from('loan_documents').insert({
      user_id: user.id,
      title,
      store_photo_url: storePhotoUrl || null,
      interior_photo_url: interiorPhotoUrl || null,
      report_period_start: periodStart,
      report_period_end: periodEnd,
      status: 'draft',
    });

    setCreating(false);
    if (error) { toast.error('สร้างเอกสารไม่สำเร็จ'); return; }
    toast.success('สร้างชุดเอกสารแล้ว');
    setShowForm(false);
    fetchDocs();
  };

  const handlePrintLoan = (doc: LoanDocument) => {
    if (!settings || !previewData) { toast.info('กรุณากด "ดูตัวอย่าง" ก่อน'); return; }
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) { toast.error('กรุณาอนุญาต popup'); return; }

    const totalRevenue = previewData.totalSales + previewData.totalBank;

    printWindow.document.write(`
      <!DOCTYPE html><html lang="th"><head>
      <meta charset="UTF-8"/><title>${doc.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet"/>
      <style>body{font-family:Sarabun,sans-serif;margin:0;padding:0}
      .page{max-width:210mm;margin:0 auto;padding:20mm;min-height:297mm}
      h1{font-size:24px}h2{font-size:18px}
      .center{text-align:center}.divider{border-top:2px solid #1a1a1a;margin:20px 0}
      table{width:100%;border-collapse:collapse;font-size:13px}
      th,td{border:1px solid #ddd;padding:8px}th{background:#f5f5f5}
      .no-print{position:fixed;bottom:20px;right:20px;display:flex;gap:8px}
      @media print{.no-print{display:none!important}}</style>
      </head><body>
      <div class="page">
        <div class="center">
          <h1>${settings.store_name}</h1>
          <h2>ชุดเอกสารประกอบการขอสินเชื่อ</h2>
          <p>ผู้ยื่น: ${settings.owner_name}</p>
          <p>วันที่: ${formatDate(todayStr())}</p>
        </div>
        <div class="divider"/>
        <h3>รูปร้านค้า</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0">
          ${doc.store_photo_url ? `<div><img src="${doc.store_photo_url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px"/><p style="font-size:12px;text-align:center;color:#737373">หน้าร้าน</p></div>` : '<div style="background:#f5f5f5;height:200px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#a3a3a3">ไม่มีรูปหน้าร้าน</div>'}
          ${doc.interior_photo_url ? `<div><img src="${doc.interior_photo_url}" style="width:100%;max-height:200px;object-fit:cover;border-radius:8px"/><p style="font-size:12px;text-align:center;color:#737373">ภายในร้าน</p></div>` : '<div style="background:#f5f5f5;height:200px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#a3a3a3">ไม่มีรูปภายใน</div>'}
        </div>
        <div class="divider"/>
        <h3>สรุปรายได้ (${formatDate(doc.report_period_start||'')} - ${formatDate(doc.report_period_end||'')})</h3>
        <table>
          <tr><th>รายการ</th><th>จำนวน</th></tr>
          <tr><td>รายได้จากการขาย (เงินสด)</td><td style="text-align:right">${formatCurrency(previewData.totalSales)}</td></tr>
          <tr><td>รายได้จากการโอน</td><td style="text-align:right">${formatCurrency(previewData.totalBank)}</td></tr>
          <tr><td style="font-weight:700">รายได้รวม</td><td style="text-align:right;font-weight:700">${formatCurrency(totalRevenue)}</td></tr>
        </table>
        <div style="margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px">
          <div><p>ลายเซ็นผู้ประกอบการ</p><div style="border-bottom:1px solid #1a1a1a;margin-top:40px;margin-bottom:8px"></div><p>${settings.owner_name}</p></div>
          <div><p>ตรวจสอบโดย</p><div style="border-bottom:1px solid #1a1a1a;margin-top:40px;margin-bottom:8px"></div><p>วันที่: ................................</p></div>
        </div>
      </div>
      <div class="no-print">
        <button onclick="window.print()" style="background:#1a1a1a;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-family:Sarabun;cursor:pointer">พิมพ์ / บันทึก PDF</button>
        <button onclick="window.close()" style="background:white;border:1px solid #e5e5e5;padding:12px 24px;border-radius:8px;font-size:15px;font-family:Sarabun;cursor:pointer">ปิด</button>
      </div>
      </body></html>
    `);
    printWindow.document.close();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('loan_documents').delete().eq('id', id);
    setDocs(prev => prev.filter(d => d.id !== id));
    toast.success('ลบเอกสารแล้ว');
  };

  return (
    <div className="page-container">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[#1a1a1a]">เอกสารยื่นกู้</h1>
          <p className="text-xs text-[#737373]">สร้างชุดเอกสารสำหรับยื่นกู้ธนาคาร</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary px-3 py-2 text-sm">
          <Plus size={16} />สร้างใหม่
        </button>
      </div>

      <div className="page-content">
        {showForm && (
          <div className="card-base space-y-3">
            <p className="section-title">สร้างชุดเอกสารใหม่</p>
            <div>
              <label className="label-base">ชื่อชุดเอกสาร</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="input-base" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-base">ช่วงรายงาน (เริ่ม)</label>
                <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="input-base" />
              </div>
              <div>
                <label className="label-base">ช่วงรายงาน (สิ้นสุด)</label>
                <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="input-base" />
              </div>
            </div>
            <div>
              <label className="label-base">รูปหน้าร้าน</label>
              <input type="file" accept="image/*" onChange={e => setStorePhotoFile(e.target.files?.[0] || null)} className="input-base text-sm" />
            </div>
            <div>
              <label className="label-base">รูปภายในร้าน</label>
              <input type="file" accept="image/*" onChange={e => setInteriorPhotoFile(e.target.files?.[0] || null)} className="input-base text-sm" />
            </div>
            <button onClick={handlePreview} className="btn-secondary w-full">
              ดูตัวอย่างข้อมูล ({formatDate(periodStart)} - {formatDate(periodEnd)})
            </button>
            {previewData && (
              <div className="p-3 bg-[#f5f5f5] rounded-xl text-sm space-y-1">
                <p className="font-medium">ข้อมูลที่จะรวมในเอกสาร:</p>
                <p className="text-[#525252]">รายการขาย: {previewData.sales.length} รายการ</p>
                <p className="text-[#525252]">รายได้รวม: {formatCurrency(previewData.totalSales + previewData.totalBank)}</p>
              </div>
            )}
            <button onClick={handleCreate} disabled={creating} className="btn-primary w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
              {creating ? 'กำลังสร้าง...' : 'สร้างชุดเอกสาร'}
            </button>
          </div>
        )}

        <div className="card-base">
          <p className="section-title mb-3">ชุดเอกสารทั้งหมด</p>
          {loading ? (
            <div className="space-y-2">{[...Array(3)].map((_,i) => <div key={i} className="h-16 bg-[#f5f5f5] rounded-xl animate-pulse"/>)}</div>
          ) : docs.length === 0 ? (
            <p className="text-sm text-[#a3a3a3] text-center py-6">ยังไม่มีชุดเอกสาร กดปุ่ม "สร้างใหม่"</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <div key={doc.id} className="p-3 border border-[#e5e5e5] rounded-xl">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1a1a1a] truncate">{doc.title}</p>
                      <p className="text-xs text-[#737373]">
                        {formatDate(doc.report_period_start || '')} - {formatDate(doc.report_period_end || '')}
                      </p>
                      <span className={doc.status === 'ready' ? 'badge-success' : 'badge-neutral mt-1'}>
                        {doc.status === 'draft' ? 'ร่าง' : doc.status === 'ready' ? 'พร้อม' : 'ยื่นแล้ว'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handlePrintLoan(doc)} className="p-2 hover:bg-[#f5f5f5] rounded-lg text-[#2563eb]" title="พิมพ์">
                        <Printer size={16} />
                      </button>
                      <button onClick={() => handleDelete(doc.id)} className="p-2 hover:bg-red-50 rounded-lg text-[#dc2626]" title="ลบ">
                        <Trash2 size={16} />
                      </button>
                    </div>
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
