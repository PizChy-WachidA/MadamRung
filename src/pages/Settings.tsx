import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { Save, Loader2, Plus, Trash2, LogOut, Download, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { exportAllDataJSON, parseSalesCSV } from '@/lib/csv-handler';
import type { StoreSettings, ProductCategory, BankAccount, Supplier, SaleRecord, BankIncomeRecord, PurchaseBill } from '@/types';

export default function Settings() {
  const { user, logout } = useAuth();
  const [settings, setSettings] = useState<Partial<StoreSettings>>({
    store_name: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง',
    owner_name: 'นางสาวรุ่ง หังษาบุตร',
    phone: '081-383-0622',
    address: '',
    tax_id: '',
  });
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [newBank, setNewBank] = useState({ bank_name: '', account_name: '', account_number: '', account_type: 'ออมทรัพย์', is_primary: false });
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', contact_name: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [{ data: s }, { data: c }, { data: b }, { data: sup }] = await Promise.all([
      supabase.from('store_settings').select('*').eq('user_id', user.id).single(),
      supabase.from('product_categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('bank_accounts').select('*').eq('user_id', user.id).order('is_primary', { ascending: false }),
      supabase.from('suppliers').select('*').eq('user_id', user.id).order('name'),
    ]);
    if (s) setSettings(s as StoreSettings);
    setCategories((c || []) as ProductCategory[]);
    setBankAccounts((b || []) as BankAccount[]);
    setSuppliers((sup || []) as Supplier[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleSaveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);

    let logoUrl = settings.logo_url || '';
    if (logoFile) {
      const path = `${user.id}/logo-${Date.now()}.jpg`;
      const { data } = await supabase.storage.from('store-assets').upload(path, logoFile, { upsert: true });
      if (data) logoUrl = supabase.storage.from('store-assets').getPublicUrl(data.path).data.publicUrl;
    }

    const payload = { ...settings, user_id: user.id, logo_url: logoUrl, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('store_settings').upsert(payload, { onConflict: 'user_id' });
    setSavingSettings(false);
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return; }
    toast.success('บันทึกข้อมูลร้านแล้ว');
    setLogoFile(null);
    fetchAll();
  };

  const addCategory = async () => {
    if (!user || !newCategory.trim()) return;
    const { data, error } = await supabase.from('product_categories').insert({ user_id: user.id, name: newCategory.trim() }).select().single();
    if (error) { toast.error('เพิ่มหมวดหมู่ไม่สำเร็จ'); return; }
    setCategories(prev => [...prev, data as ProductCategory]);
    setNewCategory('');
    toast.success('เพิ่มหมวดหมู่แล้ว');
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('product_categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
    toast.success('ลบหมวดหมู่แล้ว');
  };

  const addBankAccount = async () => {
    if (!user || !newBank.bank_name.trim() || !newBank.account_number.trim()) { toast.error('กรุณากรอกธนาคารและเลขบัญชี'); return; }
    const { data, error } = await supabase.from('bank_accounts').insert({ user_id: user.id, ...newBank }).select().single();
    if (error) { toast.error('เพิ่มบัญชีไม่สำเร็จ'); return; }
    setBankAccounts(prev => [...prev, data as BankAccount]);
    setNewBank({ bank_name: '', account_name: '', account_number: '', account_type: 'ออมทรัพย์', is_primary: false });
    toast.success('เพิ่มบัญชีแล้ว');
  };

  const deleteBankAccount = async (id: string) => {
    await supabase.from('bank_accounts').delete().eq('id', id);
    setBankAccounts(prev => prev.filter(b => b.id !== id));
  };

  const addSupplier = async () => {
    if (!user || !newSupplier.name.trim()) { toast.error('กรุณากรอกชื่อคนขายส่ง'); return; }
    const { data, error } = await supabase.from('suppliers').insert({ user_id: user.id, ...newSupplier }).select().single();
    if (error) { toast.error('เพิ่มคนขายส่งไม่สำเร็จ'); return; }
    setSuppliers(prev => [...prev, data as Supplier]);
    setNewSupplier({ name: '', phone: '', contact_name: '' });
    toast.success('เพิ่มคนขายส่งแล้ว');
  };

  const deleteSupplier = async (id: string) => {
    await supabase.from('suppliers').delete().eq('id', id);
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  const handleExportJSON = async () => {
    if (!user) return;
    toast.loading('กำลังเตรียมข้อมูล...', { id: 'export' });
    const [{ data: sales }, { data: bank }, { data: bills }] = await Promise.all([
      supabase.from('sales_records').select('*').eq('user_id', user.id),
      supabase.from('bank_income_records').select('*').eq('user_id', user.id),
      supabase.from('purchase_bills').select('*, purchase_bill_items(*)').eq('user_id', user.id),
    ]);
    exportAllDataJSON({ sales: (sales || []) as SaleRecord[], bankIncome: (bank || []) as BankIncomeRecord[], purchaseBills: (bills || []) as PurchaseBill[] });
    toast.success('Export JSON เสร็จแล้ว', { id: 'export' });
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !user) return;
    toast.loading('กำลัง Import...', { id: 'import' });
    const text = await f.text();
    const rows = parseSalesCSV(text);
    if (rows.length === 0) { toast.error('ไม่พบข้อมูลใน CSV', { id: 'import' }); return; }
    const records = rows.map(r => ({ user_id: user.id, ...r, source: 'manual' as const }));
    const { error } = await supabase.from('sales_records').insert(records);
    if (error) { toast.error('Import ล้มเหลว', { id: 'import' }); return; }
    toast.success(`Import ${rows.length} รายการสำเร็จ`, { id: 'import' });
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="text-base font-semibold">ตั้งค่า</h1></div>
        <div className="page-content">{[...Array(4)].map((_,i) => <div key={i} className="h-24 bg-[#f5f5f5] rounded-xl animate-pulse"/>)}</div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">ตั้งค่า</h1>
        <p className="text-xs text-[#737373]">ข้อมูลร้านและการจัดการ</p>
      </div>

      <div className="page-content">
        {/* Store info */}
        <div className="card-base space-y-3">
          <p className="section-title">ข้อมูลร้านค้า</p>
          {[
            { key: 'store_name', label: 'ชื่อร้าน', placeholder: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง' },
            { key: 'owner_name', label: 'ชื่อเจ้าของ', placeholder: 'นางสาวรุ่ง หังษาบุตร' },
            { key: 'phone', label: 'เบอร์โทร', placeholder: '081-383-0622' },
            { key: 'address', label: 'ที่อยู่', placeholder: 'ที่อยู่ร้าน' },
            { key: 'tax_id', label: 'เลขประจำตัวผู้เสียภาษี', placeholder: '0-0000-00000-00-0' },
          ].map(field => (
            <div key={field.key}>
              <label className="label-base">{field.label}</label>
              <input
                type="text"
                value={(settings as Record<string, string>)[field.key] || ''}
                onChange={e => setSettings(prev => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                className="input-base"
              />
            </div>
          ))}

          <div>
            <label className="label-base">โลโก้ร้าน</label>
            {settings.logo_url && <img src={settings.logo_url} alt="logo" className="w-20 h-20 object-contain rounded-xl border border-[#e5e5e5] mb-2" />}
            <button onClick={() => logoRef.current?.click()} className="btn-secondary w-full">
              <Upload size={16} />{settings.logo_url ? 'เปลี่ยนโลโก้' : 'อัปโหลดโลโก้'}
            </button>
            {logoFile && <p className="text-xs text-[#737373] mt-1">เลือกไฟล์: {logoFile.name}</p>}
            <input ref={logoRef} type="file" accept="image/*" onChange={e => setLogoFile(e.target.files?.[0] || null)} className="hidden" />
          </div>

          <button onClick={handleSaveSettings} disabled={savingSettings} className="btn-primary w-full">
            {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
            {savingSettings ? 'กำลังบันทึก...' : 'บันทึกข้อมูลร้าน'}
          </button>
        </div>

        {/* Categories */}
        <div className="card-base space-y-3">
          <p className="section-title">หมวดหมู่สินค้า</p>
          <div className="flex gap-2">
            <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="ชื่อหมวดหมู่ใหม่" className="input-base flex-1" />
            <button onClick={addCategory} className="btn-primary px-3"><Plus size={16} /></button>
          </div>
          <div className="space-y-1">
            {categories.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#f5f5f5]">
                <span className="text-sm">{c.name}</span>
                <button onClick={() => deleteCategory(c.id)} className="text-[#dc2626] hover:bg-red-50 p-1 rounded"><Trash2 size={14} /></button>
              </div>
            ))}
            {categories.length === 0 && <p className="text-sm text-[#a3a3a3] text-center py-2">ยังไม่มีหมวดหมู่</p>}
          </div>
        </div>

        {/* Bank accounts */}
        <div className="card-base space-y-3">
          <p className="section-title">บัญชีธนาคาร</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newBank.bank_name} onChange={e => setNewBank(p => ({ ...p, bank_name: e.target.value }))} placeholder="ธนาคาร เช่น กสิกรไทย" className="input-base text-sm" />
              <input type="text" value={newBank.account_name} onChange={e => setNewBank(p => ({ ...p, account_name: e.target.value }))} placeholder="ชื่อบัญชี" className="input-base text-sm" />
            </div>
            <div className="flex gap-2">
              <input type="text" value={newBank.account_number} onChange={e => setNewBank(p => ({ ...p, account_number: e.target.value }))} placeholder="เลขบัญชี" className="input-base flex-1 text-sm" />
              <button onClick={addBankAccount} className="btn-primary px-3"><Plus size={16} /></button>
            </div>
          </div>
          <div className="space-y-2">
            {bankAccounts.map(b => (
              <div key={b.id} className="flex items-center justify-between p-3 rounded-xl bg-[#fafafa] border border-[#e5e5e5]">
                <div>
                  <p className="text-sm font-medium">{b.bank_name} {b.account_number}</p>
                  <p className="text-xs text-[#737373]">{b.account_name}{b.is_primary ? ' · บัญชีหลัก' : ''}</p>
                </div>
                <button onClick={() => deleteBankAccount(b.id)} className="text-[#dc2626] p-1 rounded hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {bankAccounts.length === 0 && <p className="text-sm text-[#a3a3a3] text-center py-2">ยังไม่มีบัญชี</p>}
          </div>
        </div>

        {/* Suppliers */}
        <div className="card-base space-y-3">
          <p className="section-title">คนขายส่ง</p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" value={newSupplier.name} onChange={e => setNewSupplier(p => ({ ...p, name: e.target.value }))} placeholder="ชื่อร้าน/บริษัท" className="input-base text-sm" />
              <input type="text" value={newSupplier.phone} onChange={e => setNewSupplier(p => ({ ...p, phone: e.target.value }))} placeholder="เบอร์โทร" className="input-base text-sm" />
            </div>
            <div className="flex gap-2">
              <input type="text" value={newSupplier.contact_name} onChange={e => setNewSupplier(p => ({ ...p, contact_name: e.target.value }))} placeholder="ผู้ติดต่อ (ไม่บังคับ)" className="input-base flex-1 text-sm" />
              <button onClick={addSupplier} className="btn-primary px-3"><Plus size={16} /></button>
            </div>
          </div>
          <div className="space-y-1">
            {suppliers.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-[#f5f5f5]">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  {s.phone && <p className="text-xs text-[#737373]">{s.phone}</p>}
                </div>
                <button onClick={() => deleteSupplier(s.id)} className="text-[#dc2626] p-1 rounded hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            ))}
            {suppliers.length === 0 && <p className="text-sm text-[#a3a3a3] text-center py-2">ยังไม่มีคนขายส่ง</p>}
          </div>
        </div>

        {/* Backup */}
        <div className="card-base space-y-3">
          <p className="section-title">สำรองข้อมูล</p>
          <div className="p-3 bg-[#f5f5f5] rounded-xl text-sm text-[#525252]">
            <p className="font-medium mb-1">สถานะ Sync</p>
            <p>✅ เชื่อมต่อ OnSpace Cloud (Supabase) แล้ว</p>
            <p className="text-xs text-[#737373] mt-1">ข้อมูลถูกบันทึกบน Cloud ตลอดเวลา</p>
          </div>
          <button onClick={handleExportJSON} className="btn-secondary w-full"><Download size={16} />Export ข้อมูลทั้งหมด (JSON)</button>
          <div>
            <button onClick={() => csvRef.current?.click()} className="btn-secondary w-full"><Upload size={16} />Import ข้อมูล (CSV)</button>
            <p className="text-xs text-[#a3a3a3] mt-1 text-center">รองรับไฟล์ CSV รายการขายเท่านั้น ดาวน์โหลด Template จากหน้ารายงาน</p>
            <input ref={csvRef} type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
          </div>
        </div>

        {/* User info */}
        <div className="card-base">
          <p className="section-title mb-2">บัญชีผู้ใช้</p>
          <div className="p-3 bg-[#f5f5f5] rounded-xl mb-4">
            <p className="text-xs text-[#737373]">เบอร์มือถือ</p>
            <p className="text-base font-bold text-[#1a1a1a] tracking-wide">081-383-0622</p>
            <p className="text-xs text-[#a3a3a3] mt-0.5">นางสาวรุ่ง หังษาบุตร</p>
          </div>
          <button onClick={logout} className="btn-danger w-full">
            <LogOut size={16} />ออกจากระบบ
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
