import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanLine, PenLine, Wallet, ShoppingCart, TrendingUp, TrendingDown, Clock, RefreshCw } from 'lucide-react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import BottomNav from '@/components/layout/BottomNav';
import { formatCurrency, todayStr, monthStart, monthEnd, yearStart, yearEnd, last7Days, dayLabel, formatDate } from '@/lib/utils';
import type { DashboardData, SaleRecord } from '@/types';

export default function Index() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const today = todayStr();
    const mStart = monthStart();
    const mEnd = monthEnd();
    const yStart = yearStart();
    const yEnd = yearEnd();
    const days = last7Days();

    const [
      { data: todaySales },
      { data: todayBank },
      { data: todayPurchase },
      { data: monthSales },
      { data: monthBank },
      { data: yearSales },
      { data: pendingOCR },
      { data: unpaidBills },
      { data: recentSales },
    ] = await Promise.all([
      supabase.from('sales_records').select('total_price').eq('user_id', user.id).eq('date', today),
      supabase.from('bank_income_records').select('amount').eq('user_id', user.id).eq('date', today),
      supabase.from('purchase_bills').select('net_amount').eq('user_id', user.id).eq('bill_date', today),
      supabase.from('sales_records').select('total_price').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('bank_income_records').select('amount').eq('user_id', user.id).gte('date', mStart).lte('date', mEnd),
      supabase.from('sales_records').select('total_price').eq('user_id', user.id).gte('date', yStart).lte('date', yEnd),
      supabase.from('ocr_jobs').select('id', { count: 'exact' }).eq('user_id', user.id).eq('status', 'pending'),
      supabase.from('purchase_bills').select('id', { count: 'exact' }).eq('user_id', user.id).eq('payment_status', 'ยังไม่จ่าย'),
      supabase.from('sales_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
    ]);

    const sum = (arr: { total_price: number }[] | null) => (arr || []).reduce((s, r) => s + Number(r.total_price), 0);
    const sumA = (arr: { amount: number }[] | null) => (arr || []).reduce((s, r) => s + Number(r.amount), 0);
    const sumN = (arr: { net_amount: number }[] | null) => (arr || []).reduce((s, r) => s + Number(r.net_amount), 0);

    const ts = sum(todaySales);
    const tb = sumA(todayBank);
    const tp = sumN(todayPurchase);

    // Fetch weekly sales
    const weeklyPromises = days.map(d =>
      supabase.from('sales_records').select('total_price').eq('user_id', user.id).eq('date', d)
    );
    const weeklyResults = await Promise.all(weeklyPromises);
    const weeklySales = days.map((d, i) => ({
      date: d,
      label: dayLabel(d),
      amount: sum(weeklyResults[i].data),
    }));

    setData({
      todaySales: ts,
      todayBankIncome: tb,
      todayPurchase: tp,
      todayProfit: ts + tb - tp,
      monthSales: sum(monthSales),
      monthBankIncome: sumA(monthBank),
      yearSales: sum(yearSales),
      pendingOCR: pendingOCR?.length ?? 0,
      unpaidBills: unpaidBills?.length ?? 0,
      recentSales: (recentSales as SaleRecord[]) || [],
      weeklySales,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const MetricCard = ({ label, value, sub, icon, color }: { label: string; value: string; sub?: string; icon?: React.ReactNode; color?: string }) => (
    <div className="metric-card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-[#737373] mb-1">{label}</p>
          <p className={`text-xl font-bold ${color || 'text-[#1a1a1a]'}`}>{value}</p>
          {sub && <p className="text-xs text-[#a3a3a3] mt-0.5">{sub}</p>}
        </div>
        {icon && <div className="text-[#a3a3a3]">{icon}</div>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="text-base font-semibold text-[#1a1a1a]">ร้านมาดามรุ่ง</h1>
          <p className="text-xs text-[#737373]">ระบบบัญชีร้านค้า</p>
        </div>
        <div className="page-content">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="metric-card animate-pulse">
              <div className="h-4 w-24 bg-[#f5f5f5] rounded mb-2"></div>
              <div className="h-7 w-32 bg-[#f5f5f5] rounded"></div>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  const d = data!;

  return (
    <div className="page-container">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-[#1a1a1a]">ร้านมาดามรุ่ง</h1>
          <p className="text-xs text-[#737373]">ระบบบัญชีร้านค้า</p>
        </div>
        <button onClick={fetchDashboard} className="p-2 rounded-full hover:bg-[#f5f5f5]">
          <RefreshCw size={16} className="text-[#737373]" />
        </button>
      </div>

      <div className="page-content">
        {/* Today summary */}
        <div className="card-base">
          <p className="text-xs font-semibold text-[#737373] uppercase tracking-wide mb-3">วันนี้</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-[#737373]">💰 ยอดขาย</p>
              <p className="text-xl font-bold text-[#1a1a1a]">{formatCurrency(d.todaySales)}</p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">📱 รับโอน</p>
              <p className="text-xl font-bold text-[#1a1a1a]">{formatCurrency(d.todayBankIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">🛒 ซื้อของ</p>
              <p className="text-xl font-bold text-[#dc2626]">{formatCurrency(d.todayPurchase)}</p>
            </div>
            <div>
              <p className="text-xs text-[#737373]">📊 กำไร</p>
              <p className={`text-xl font-bold ${d.todayProfit >= 0 ? 'text-[#16a34a]' : 'text-[#dc2626]'}`}>
                {formatCurrency(d.todayProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* Month + Year */}
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="ยอดขายเดือนนี้"
            value={formatCurrency(d.monthSales + d.monthBankIncome)}
            sub={`เงินสด ${formatCurrency(d.monthSales)} + โอน ${formatCurrency(d.monthBankIncome)}`}
            icon={<TrendingUp size={20} />}
          />
          <MetricCard
            label="ยอดขายปีนี้"
            value={formatCurrency(d.yearSales)}
            icon={<TrendingUp size={20} />}
          />
        </div>

        {/* Alerts */}
        {(d.pendingOCR > 0 || d.unpaidBills > 0) && (
          <div className="space-y-2">
            {d.pendingOCR > 0 && (
              <button
                onClick={() => navigate('/scan')}
                className="w-full flex items-center gap-3 p-3 bg-orange-50 border border-orange-100 rounded-xl text-left"
              >
                <Clock size={16} className="text-orange-600 flex-shrink-0" />
                <span className="text-sm text-orange-800">มี <strong>{d.pendingOCR} รายการ</strong> รอตรวจสอบจาก OCR</span>
              </button>
            )}
            {d.unpaidBills > 0 && (
              <button
                onClick={() => navigate('/purchase-bills')}
                className="w-full flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl text-left"
              >
                <TrendingDown size={16} className="text-red-600 flex-shrink-0" />
                <span className="text-sm text-red-800">มี <strong>{d.unpaidBills} บิล</strong> ที่ยังไม่จ่ายเงิน</span>
              </button>
            )}
          </div>
        )}

        {/* 7-day chart */}
        <div className="card-base">
          <p className="section-title mb-3">ยอดขาย 7 วันล่าสุด</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={d.weeklySales} barSize={28}>
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#737373' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [formatCurrency(value), 'ยอดขาย']}
                contentStyle={{ fontFamily: 'Sarabun, sans-serif', fontSize: 12, borderRadius: 8, border: '1px solid #e5e5e5' }}
                cursor={{ fill: '#f5f5f5' }}
              />
              <Bar dataKey="amount" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quick actions */}
        <div className="card-base">
          <p className="section-title mb-3">เข้าใช้งานด่วน</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => navigate('/entry')} className="btn-primary">
              <PenLine size={16} />กรอกขาย
            </button>
            <button onClick={() => navigate('/scan')} className="btn-secondary">
              <ScanLine size={16} />สแกนสมุด
            </button>
            <button onClick={() => navigate('/bank-income')} className="btn-secondary">
              <Wallet size={16} />รับโอน
            </button>
            <button onClick={() => navigate('/purchase-bills')} className="btn-secondary">
              <ShoppingCart size={16} />บิลซื้อ
            </button>
          </div>
        </div>

        {/* Recent sales */}
        {d.recentSales.length > 0 && (
          <div className="card-base">
            <div className="flex items-center justify-between mb-3">
              <p className="section-title">รายการขายล่าสุด</p>
              <button onClick={() => navigate('/entry')} className="text-xs text-[#2563eb]">ดูทั้งหมด</button>
            </div>
            <div className="space-y-2">
              {d.recentSales.map((sale) => (
                <div key={sale.id} className="flex items-center justify-between py-2 border-b border-[#f5f5f5] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-[#1a1a1a]">{sale.item_name}</p>
                    <p className="text-xs text-[#a3a3a3]">{formatDate(sale.date)} · {sale.quantity} ชิ้น</p>
                  </div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">{formatCurrency(sale.total_price)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
