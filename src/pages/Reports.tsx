import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Download, Printer, FileText, FileDown } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatCurrency, formatDate, monthStart, monthEnd, todayStr } from '@/lib/utils';
import {
  printSalesReport, printBankIncomeReport,
  printPurchaseBillsReport, printProfitLossReport
} from '@/lib/pdf-generator';
import {
  exportSalesCSV, exportBankIncomeCSV, exportPurchaseBillsCSV,
  exportSalesTemplateCSV, exportBankIncomeTemplateCSV, exportPurchaseBillsTemplateCSV
} from '@/lib/csv-handler';
import { exportSalesWord, exportProfitLossWord } from '@/lib/word-generator';
import type { SaleRecord, BankIncomeRecord, PurchaseBill, StoreSettings } from '@/types';

type TabType = 'sales' | 'bank' | 'purchase' | 'profit';
type SalesViewMode = 'list' | 'monthly';

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabType>('sales');
  const [salesView, setSalesView] = useState<SalesViewMode>('list');
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(monthEnd());
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [bankIncome, setBankIncome] = useState<BankIncomeRecord[]>([]);
  const [purchaseBills, setPurchaseBills] = useState<PurchaseBill[]>([]);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('store_settings').select('*').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data) setSettings(data as StoreSettings);
        else setSettings({ id: '', user_id: user.id, store_name: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง', owner_name: 'นางสาวรุ่ง หังษาบุตร', phone: '081-383-0622', updated_at: '' });
      });
  }, [user]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: s }, { data: b }, { data: p }] = await Promise.all([
      supabase.from('sales_records').select('*').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date'),
      supabase.from('bank_income_records').select('*, bank_accounts(*)').eq('user_id', user.id).gte('date', startDate).lte('date', endDate).order('date'),
      supabase.from('purchase_bills').select('*, suppliers(*), purchase_bill_items(*)').eq('user_id', user.id).gte('bill_date', startDate).lte('bill_date', endDate).order('bill_date'),
    ]);
    setSales((s || []) as SaleRecord[]);
    setBankIncome((b || []) as BankIncomeRecord[]);
    setPurchaseBills((p || []) as PurchaseBill[]);
    setLoading(false);
  }, [user, startDate, endDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalSales = sales.reduce((s, r) => s + Number(r.total_price), 0);
  const totalBank = bankIncome.reduce((s, r) => s + Number(r.amount), 0);
  const totalPurchase = purchaseBills.reduce((s, r) => s + Number(r.net_amount), 0);
  const totalRevenue = totalSales + totalBank;
  const grossProfit = totalRevenue - totalPurchase;

  const chartData = (() => {
    const map: Record<string, number> = {};
    if (tab === 'sales') sales.forEach(r => { map[r.date] = (map[r.date] || 0) + Number(r.total_price); });
    if (tab === 'bank') bankIncome.forEach(r => { map[r.date] = (map[r.date] || 0) + Number(r.amount); });
    if (tab === 'purchase') purchaseBills.forEach(r => { map[r.bill_date] = (map[r.bill_date] || 0) + Number(r.net_amount); });
    return Object.entries(map).slice(-14).map(([date, amount]) => ({
      date: formatDate(date), amount
    }));
  })();

  const handlePrint = () => {
    if (!settings) return;
    if (tab === 'sales') printSalesReport(sales, settings, startDate, endDate, 'daily');
    else if (tab === 'bank') printBankIncomeReport(bankIncome, settings, startDate, endDate);
    else if (tab === 'purchase') printPurchaseBillsReport(purchaseBills, settings, startDate, endDate);
    else if (tab === 'profit') {
      const now = new Date();
      printProfitLossReport({ totalSales, totalBankIncome: totalBank, totalPurchase, month: now.getMonth() + 1, year: now.getFullYear() }, settings);
    }
  };

  const handleExportWord = async () => {
    if (!settings) return;
    try {
      toast.loading('กำลังสร้างไฟล์ Word...', { id: 'word-export' });
      if (tab === 'sales') {
        await exportSalesWord(sales, settings, startDate, endDate);
      } else if (tab === 'profit') {
        const now = new Date();
        await exportProfitLossWord({ totalSales, totalBankIncome: totalBank, totalPurchase, month: now.getMonth() + 1, year: now.getFullYear() }, settings);
      } else {
        toast.dismiss('word-export');
        toast.info('Export Word รองรับเฉพาะ tab ยอดขาย และ กำไร-ขาดทุน');
        return;
      }
      toast.success('ดาวน์โหลดไฟล์ Word แล้ว', { id: 'word-export' });
    } catch (e) {
      toast.error('สร้างไฟล์ Word ล้มเหลว', { id: 'word-export' });
      console.error(e);
    }
  };

  // Compute monthly summary for sales
  const monthlySummary = (() => {
    const dayMap: Record<string, { sales: number; count: number; qty: number }> = {};
    sales.forEach(r => {
      if (!dayMap[r.date]) dayMap[r.date] = { sales: 0, count: 0, qty: 0 };
      dayMap[r.date].sales += Number(r.total_price);
      dayMap[r.date].count += 1;
      dayMap[r.date].qty += Number(r.quantity);
    });
    return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, v]) => ({ date, ...v }));
  })();

  const topProducts = (() => {
    const map: Record<string, { qty: number; total: number }> = {};
    sales.forEach(r => {
      if (!map[r.item_name]) map[r.item_name] = { qty: 0, total: 0 };
      map[r.item_name].qty += Number(r.quantity);
      map[r.item_name].total += Number(r.total_price);
    });
    return Object.entries(map).sort(([,a],[,b]) => b.total - a.total).slice(0, 10).map(([name, v]) => ({ name, ...v }));
  })();

  const handleExportCSV = () => {
    if (tab === 'sales') exportSalesCSV(sales);
    else if (tab === 'bank') exportBankIncomeCSV(bankIncome);
    else if (tab === 'purchase') exportPurchaseBillsCSV(purchaseBills);
    else toast.info('กรุณาเลือก tab รายการขาย/รับโอน/บิลซื้อ');
  };

  const handleExportTemplate = () => {
    if (tab === 'sales') exportSalesTemplateCSV();
    else if (tab === 'bank') exportBankIncomeTemplateCSV();
    else if (tab === 'purchase') exportPurchaseBillsTemplateCSV();
    else toast.info('กรุณาเลือก tab ที่ต้องการ template');
  };

  const tabs: { key: TabType; label: string }[] = [
    { key: 'sales', label: 'ยอดขาย' },
    { key: 'bank', label: 'รับโอน' },
    { key: 'purchase', label: 'บิลซื้อ' },
    { key: 'profit', label: 'กำไร' },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="text-base font-semibold text-[#1a1a1a]">รายงาน</h1>
        <p className="text-xs text-[#737373]">สรุปข้อมูลและ Export เอกสาร</p>
      </div>

      <div className="page-content">
        {/* Date filter */}
        <div className="card-base">
          <p className="text-sm font-medium text-[#1a1a1a] mb-3">เลือกช่วงวันที่</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-base">วันเริ่มต้น</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-base" />
            </div>
            <div>
              <label className="label-base">วันสิ้นสุด</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-base" />
            </div>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            {[
              { label: 'เดือนนี้', s: monthStart(), e: monthEnd() },
              { label: '30 วัน', s: new Date(Date.now()-30*86400000).toISOString().slice(0,10), e: todayStr() },
              { label: 'ปีนี้', s: `${new Date().getFullYear()}-01-01`, e: `${new Date().getFullYear()}-12-31` },
            ].map(p => (
              <button key={p.label} onClick={() => { setStartDate(p.s); setEndDate(p.e); }}
                className="text-xs px-3 py-1.5 rounded-lg border border-[#e5e5e5] hover:bg-[#f5f5f5]">
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#e5e5e5]">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors
                ${tab === t.key ? 'text-[#1a1a1a] border-b-2 border-[#1a1a1a]' : 'text-[#737373]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {tab === 'sales' && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="metric-card text-center">
                <p className="text-xs text-[#737373]">รายการ</p>
                <p className="text-xl font-bold">{sales.length}</p>
              </div>
              <div className="metric-card text-center">
                <p className="text-xs text-[#737373]">สินค้า</p>
                <p className="text-xl font-bold">{sales.reduce((s,r)=>s+r.quantity,0)}</p>
              </div>
              <div className="metric-card text-center">
                <p className="text-xs text-[#737373]">ยอดรวม</p>
                <p className="text-base font-bold text-[#16a34a]">{formatCurrency(totalSales)}</p>
              </div>
            </div>
            {/* View mode toggle */}
            <div className="flex rounded-xl border border-[#e5e5e5] overflow-hidden">
              <button
                onClick={() => setSalesView('list')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  salesView === 'list' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#737373] hover:bg-[#f5f5f5]'
                }`}
              >
                รายการ
              </button>
              <button
                onClick={() => setSalesView('monthly')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  salesView === 'monthly' ? 'bg-[#1a1a1a] text-white' : 'bg-white text-[#737373] hover:bg-[#f5f5f5]'
                }`}
              >
                สรุปรายเดือน
              </button>
            </div>
          </>
        )}

        {tab === 'bank' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card text-center">
              <p className="text-xs text-[#737373]">รายการ</p>
              <p className="text-xl font-bold">{bankIncome.length}</p>
            </div>
            <div className="metric-card text-center">
              <p className="text-xs text-[#737373]">ยอดรวม</p>
              <p className="text-base font-bold text-[#16a34a]">{formatCurrency(totalBank)}</p>
            </div>
          </div>
        )}

        {tab === 'purchase' && (
          <div className="grid grid-cols-2 gap-2">
            <div className="metric-card text-center">
              <p className="text-xs text-[#737373]">บิล</p>
              <p className="text-xl font-bold">{purchaseBills.length}</p>
            </div>
            <div className="metric-card text-center">
              <p className="text-xs text-[#737373]">ยอดรวม</p>
              <p className="text-base font-bold text-[#dc2626]">{formatCurrency(totalPurchase)}</p>
            </div>
          </div>
        )}

        {tab === 'profit' && (
          <div className="card-base space-y-3">
            <div className="flex justify-between"><span className="text-sm text-[#525252]">รายได้จากการขาย</span><span className="text-sm font-bold text-[#16a34a]">{formatCurrency(totalRevenue)}</span></div>
            <div className="pl-4 flex justify-between"><span className="text-xs text-[#737373]">- เงินสด</span><span className="text-xs">{formatCurrency(totalSales)}</span></div>
            <div className="pl-4 flex justify-between"><span className="text-xs text-[#737373]">- รับโอน</span><span className="text-xs">{formatCurrency(totalBank)}</span></div>
            <div className="divider" />
            <div className="flex justify-between"><span className="text-sm text-[#525252]">ต้นทุนสินค้า</span><span className="text-sm font-bold text-[#dc2626]">-{formatCurrency(totalPurchase)}</span></div>
            <div className="divider" />
            <div className="flex justify-between">
              <span className="text-base font-bold text-[#1a1a1a]">กำไรขั้นต้น</span>
              <span className={`text-lg font-bold ${grossProfit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>{formatCurrency(grossProfit)}</span>
            </div>
            {totalRevenue > 0 && <p className="text-xs text-[#737373] text-right">กำไร {(grossProfit/totalRevenue*100).toFixed(1)}%</p>}
          </div>
        )}

        {/* Chart */}
        {tab !== 'profit' && chartData.length > 0 && (
          <div className="card-base">
            <p className="section-title mb-3">กราฟ</p>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} barSize={20}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#737373' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis hide />
                <Tooltip formatter={(v: number) => [formatCurrency(v), '']} contentStyle={{ fontFamily: 'Sarabun', fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }} cursor={{ fill: '#f5f5f5' }} />
                <Bar dataKey="amount" fill="#1a1a1a" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Data table */}
        {loading ? (
          <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-12 bg-[#f5f5f5] rounded-xl animate-pulse"/>)}</div>
        ) : (
          <div className="card-base overflow-x-auto">
            {tab === 'sales' && salesView === 'list' && (
              sales.length === 0 ? <p className="text-sm text-[#a3a3a3] text-center py-4">ไม่มีข้อมูลในช่วงนี้</p> :
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b border-[#e5e5e5]">
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">วันที่</th>
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">สินค้า</th>
                  <th className="text-center pb-2 text-xs text-[#737373] font-medium">จำนวน</th>
                  <th className="text-right pb-2 text-xs text-[#737373] font-medium">ราคา</th>
                  <th className="text-right pb-2 text-xs text-[#737373] font-medium">รวม</th>
                </tr></thead>
                <tbody>
                  {sales.map(r => (
                    <tr key={r.id} className="border-b border-[#f5f5f5] last:border-0">
                      <td className="py-2 text-xs text-[#737373]">{formatDate(r.date)}</td>
                      <td className="py-2 max-w-[120px] truncate">{r.item_name}</td>
                      <td className="py-2 text-center">{r.quantity}</td>
                      <td className="py-2 text-right">{formatCurrency(r.unit_price)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(r.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'sales' && salesView === 'monthly' && (
              <div className="space-y-4">
                {/* Daily breakdown table */}
                <div>
                  <p className="text-sm font-semibold text-[#1a1a1a] mb-2">ยอดขายรายวัน</p>
                  {monthlySummary.length === 0 ? (
                    <p className="text-sm text-[#a3a3a3] text-center py-4">ไม่มีข้อมูลในช่วงนี้</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#e5e5e5]">
                        <th className="text-left pb-2 text-xs text-[#737373] font-medium">วันที่</th>
                        <th className="text-center pb-2 text-xs text-[#737373] font-medium">รายการ</th>
                        <th className="text-center pb-2 text-xs text-[#737373] font-medium">ชิ้น</th>
                        <th className="text-right pb-2 text-xs text-[#737373] font-medium">ยอด</th>
                      </tr></thead>
                      <tbody>
                        {monthlySummary.map((row, i) => (
                          <tr key={row.date} className={`border-b border-[#f5f5f5] last:border-0 ${i % 2 === 0 ? '' : 'bg-[#fafafa]'}`}>
                            <td className="py-2 text-xs text-[#737373]">{formatDate(row.date)}</td>
                            <td className="py-2 text-center">{row.count}</td>
                            <td className="py-2 text-center">{row.qty}</td>
                            <td className="py-2 text-right font-semibold">{formatCurrency(row.sales)}</td>
                          </tr>
                        ))}
                        <tr className="bg-[#f5f5f5] font-bold">
                          <td className="py-2 text-right text-sm pr-2" colSpan={3}>รวมทั้งหมด</td>
                          <td className="py-2 text-right text-[#16a34a]">{formatCurrency(totalSales)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>
                {/* Top products */}
                {topProducts.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-[#1a1a1a] mb-2">สินค้าขายดี</p>
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-[#e5e5e5]">
                        <th className="text-left pb-2 text-xs text-[#737373] font-medium">#</th>
                        <th className="text-left pb-2 text-xs text-[#737373] font-medium">สินค้า</th>
                        <th className="text-center pb-2 text-xs text-[#737373] font-medium">ชิ้น</th>
                        <th className="text-right pb-2 text-xs text-[#737373] font-medium">ยอด</th>
                        <th className="text-right pb-2 text-xs text-[#737373] font-medium">%</th>
                      </tr></thead>
                      <tbody>
                        {topProducts.map((p, i) => (
                          <tr key={p.name} className="border-b border-[#f5f5f5] last:border-0">
                            <td className="py-2 text-xs text-[#a3a3a3]">{i + 1}</td>
                            <td className="py-2 max-w-[120px] truncate font-medium">{p.name}</td>
                            <td className="py-2 text-center">{p.qty}</td>
                            <td className="py-2 text-right">{formatCurrency(p.total)}</td>
                            <td className="py-2 text-right text-[#737373]">{totalSales > 0 ? (p.total / totalSales * 100).toFixed(1) : 0}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {tab === 'bank' && (
              bankIncome.length === 0 ? <p className="text-sm text-[#a3a3a3] text-center py-4">ไม่มีข้อมูลในช่วงนี้</p> :
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b border-[#e5e5e5]">
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">วันที่</th>
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">ผู้โอน</th>
                  <th className="text-right pb-2 text-xs text-[#737373] font-medium">จำนวน</th>
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">สถานะ</th>
                </tr></thead>
                <tbody>
                  {bankIncome.map(r => (
                    <tr key={r.id} className="border-b border-[#f5f5f5] last:border-0">
                      <td className="py-2 text-xs text-[#737373]">{formatDate(r.date)}</td>
                      <td className="py-2 max-w-[120px] truncate">{r.sender_name || '-'}</td>
                      <td className="py-2 text-right font-medium text-[#16a34a]">{formatCurrency(r.amount)}</td>
                      <td className="py-2"><span className={r.is_matched ? 'badge-success' : 'badge-warning'}>{r.is_matched ? 'จับคู่แล้ว' : 'ยังไม่จับคู่'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {tab === 'purchase' && (
              purchaseBills.length === 0 ? <p className="text-sm text-[#a3a3a3] text-center py-4">ไม่มีข้อมูลในช่วงนี้</p> :
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b border-[#e5e5e5]">
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">วันที่</th>
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">คนขาย</th>
                  <th className="text-right pb-2 text-xs text-[#737373] font-medium">ยอดสุทธิ</th>
                  <th className="text-left pb-2 text-xs text-[#737373] font-medium">สถานะ</th>
                </tr></thead>
                <tbody>
                  {purchaseBills.map(r => (
                    <tr key={r.id} className="border-b border-[#f5f5f5] last:border-0">
                      <td className="py-2 text-xs text-[#737373]">{formatDate(r.bill_date)}</td>
                      <td className="py-2 max-w-[120px] truncate">{r.suppliers?.name || '-'}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(r.net_amount)}</td>
                      <td className="py-2"><span className={r.payment_status === 'จ่ายแล้ว' ? 'badge-success' : 'badge-danger'}>{r.payment_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Export buttons */}
        <div className="card-base">
          <p className="section-title mb-3">Export เอกสาร</p>
          <div className="space-y-2">
            <button onClick={handlePrint} className="btn-primary w-full">
              <Printer size={16} />พิมพ์ / บันทึก PDF (มาตรฐานแบงค์)
            </button>
            <button onClick={handleExportWord} className="btn-secondary w-full">
              <FileDown size={16} />Export Word (.docx)
            </button>
            <button onClick={handleExportCSV} className="btn-secondary w-full">
              <Download size={16} />Export CSV
            </button>
            <button onClick={handleExportTemplate} className="btn-secondary w-full">
              <FileText size={16} />ดาวน์โหลด CSV Template
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
