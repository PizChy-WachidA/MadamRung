import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import type { SaleRecord, BankIncomeRecord, PurchaseBill, StoreSettings } from '@/types';
import { formatCurrency, formatDate, formatThaiMonth } from './utils';

interface PrintOptions {
  title: string;
  storeSettings: StoreSettings;
  content: string;
}

function getPrintHeader(settings: StoreSettings, reportTitle: string): string {
  return `
    <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a1a1a;">
      <div style="font-size:22px;font-weight:700;margin-bottom:4px;">${settings.store_name}</div>
      <div style="font-size:14px;color:#525252;">ผู้ประกอบการ: ${settings.owner_name}</div>
      ${settings.phone ? `<div style="font-size:13px;color:#525252;">โทร: ${settings.phone}</div>` : ''}
      ${settings.address ? `<div style="font-size:13px;color:#525252;">${settings.address}</div>` : ''}
      ${settings.tax_id ? `<div style="font-size:13px;color:#525252;">เลขประจำตัวผู้เสียภาษี: ${settings.tax_id}</div>` : ''}
      <div style="font-size:18px;font-weight:600;margin-top:12px;">${reportTitle}</div>
      <div style="font-size:12px;color:#737373;margin-top:4px;">วันที่พิมพ์: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: th })}</div>
    </div>
  `;
}

function getPrintFooter(settings: StoreSettings): string {
  return `
    <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e5e5e5;">
      <div style="font-size:11px;color:#737373;margin-bottom:20px;">
        หมายเหตุ: เอกสารนี้จัดทำจากสมุดบันทึกการขายต้นฉบับของร้าน
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:20px;">
        <div>
          <div style="font-size:13px;color:#737373;">ลายเซ็นผู้ประกอบการ</div>
          <div style="border-bottom:1px solid #1a1a1a;margin-top:40px;margin-bottom:8px;"></div>
          <div style="font-size:13px;">${settings.owner_name}</div>
          <div style="font-size:12px;color:#737373;">วันที่: ............................................</div>
        </div>
        <div>
          <div style="font-size:13px;color:#737373;">ตรวจสอบโดย</div>
          <div style="border-bottom:1px solid #1a1a1a;margin-top:40px;margin-bottom:8px;"></div>
          <div style="font-size:12px;color:#737373;">วันที่: ............................................</div>
        </div>
      </div>
    </div>
  `;
}

export function printSalesReport(
  records: SaleRecord[],
  settings: StoreSettings,
  startDate: string,
  endDate: string,
  reportType: 'daily' | 'monthly'
): void {
  const totalSales = records.reduce((s, r) => s + Number(r.total_price), 0);
  const totalItems = records.reduce((s, r) => s + Number(r.quantity), 0);
  const avgPerRecord = records.length > 0 ? totalSales / records.length : 0;

  const title = reportType === 'daily'
    ? `รายงานสรุปยอดขายประจำวัน (${formatDate(startDate)} - ${formatDate(endDate)})`
    : `รายงานสรุปยอดขายรายเดือน`;

  const rows = records.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;">${i + 1}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${formatDate(r.date)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.item_name}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;">${r.quantity}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(r.unit_price)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;font-weight:600;">${formatCurrency(r.total_price)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.category || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.notes || '-'}</td>
    </tr>
  `).join('');

  const content = `
    <div style="margin-bottom:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:#737373;">ยอดขายรวม</div>
        <div style="font-size:18px;font-weight:700;">${formatCurrency(totalSales)}</div>
      </div>
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:#737373;">จำนวนรายการ</div>
        <div style="font-size:18px;font-weight:700;">${records.length}</div>
      </div>
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:#737373;">จำนวนสินค้า</div>
        <div style="font-size:18px;font-weight:700;">${totalItems}</div>
      </div>
      <div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
        <div style="font-size:11px;color:#737373;">เฉลี่ยต่อรายการ</div>
        <div style="font-size:18px;font-weight:700;">${formatCurrency(avgPerRecord)}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#1a1a1a;color:white;">
          <th style="padding:10px 8px;border:1px solid #333;text-align:center;">ลำดับ</th>
          <th style="padding:10px 8px;border:1px solid #333;">วันที่</th>
          <th style="padding:10px 8px;border:1px solid #333;">รายการสินค้า</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:center;">จำนวน</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:right;">ราคา/ชิ้น</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:right;">จำนวนเงิน</th>
          <th style="padding:10px 8px;border:1px solid #333;">หมวดหมู่</th>
          <th style="padding:10px 8px;border:1px solid #333;">หมายเหตุ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#f5f5f5;font-weight:700;">
          <td colspan="5" style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">ยอดรวมทั้งหมด</td>
          <td style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;color:#1a1a1a;">${formatCurrency(totalSales)}</td>
          <td colspan="2" style="padding:10px 8px;border:1px solid #e5e5e5;"></td>
        </tr>
      </tbody>
    </table>
  `;

  openPrintWindow({ title, storeSettings: settings, content: getPrintHeader(settings, title) + content + getPrintFooter(settings) });
}

export function printProfitLossReport(
  data: { totalSales: number; totalBankIncome: number; totalPurchase: number; month?: number; year?: number },
  settings: StoreSettings
): void {
  const totalRevenue = data.totalSales + data.totalBankIncome;
  const grossProfit = totalRevenue - data.totalPurchase;
  const profitPct = totalRevenue > 0 ? (grossProfit / totalRevenue * 100).toFixed(1) : '0';

  const periodLabel = data.month && data.year ? formatThaiMonth(data.month, data.year) : 'ช่วงที่เลือก';
  const title = `รายงานกำไร-ขาดทุน ${periodLabel}`;

  const content = `
    <table style="width:100%;border-collapse:collapse;font-size:15px;max-width:500px;margin:0 auto;">
      <tr style="background:#f5f5f5;">
        <td colspan="2" style="padding:12px 16px;border:1px solid #e5e5e5;font-weight:700;font-size:16px;">รายได้จากการขาย</td>
        <td style="padding:12px 16px;border:1px solid #e5e5e5;text-align:right;font-weight:700;font-size:16px;">${formatCurrency(totalRevenue)}</td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 32px;border:1px solid #e5e5e5;">- เงินสด</td>
        <td style="padding:8px 16px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(data.totalSales)}</td>
        <td style="border:1px solid #e5e5e5;"></td>
      </tr>
      <tr>
        <td style="padding:8px 16px 8px 32px;border:1px solid #e5e5e5;">- รับโอน</td>
        <td style="padding:8px 16px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(data.totalBankIncome)}</td>
        <td style="border:1px solid #e5e5e5;"></td>
      </tr>
      <tr style="background:#fff3f3;">
        <td colspan="2" style="padding:12px 16px;border:1px solid #e5e5e5;font-weight:700;font-size:16px;">ต้นทุนสินค้า</td>
        <td style="padding:12px 16px;border:1px solid #e5e5e5;text-align:right;font-weight:700;color:#dc2626;">-${formatCurrency(data.totalPurchase)}</td>
      </tr>
      <tr style="background:#e8f5e9;">
        <td colspan="2" style="padding:12px 16px;border:1px solid #e5e5e5;font-weight:700;font-size:17px;">กำไรขั้นต้น</td>
        <td style="padding:12px 16px;border:1px solid #e5e5e5;text-align:right;font-weight:700;font-size:17px;color:#16a34a;">${formatCurrency(grossProfit)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:8px 16px;border:1px solid #e5e5e5;">กำไร %</td>
        <td style="padding:8px 16px;border:1px solid #e5e5e5;text-align:right;font-weight:600;">${profitPct}%</td>
      </tr>
    </table>
  `;

  openPrintWindow({ title, storeSettings: settings, content: getPrintHeader(settings, title) + content + getPrintFooter(settings) });
}

export function printBankIncomeReport(records: BankIncomeRecord[], settings: StoreSettings, startDate: string, endDate: string): void {
  const totalIncome = records.reduce((s, r) => s + Number(r.amount), 0);
  const title = `รายงานรายรับบัญชี (${formatDate(startDate)} - ${formatDate(endDate)})`;

  const rows = records.map((r, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;">${i + 1}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${formatDate(r.date)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.time_of_transfer || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;font-weight:600;">${formatCurrency(r.amount)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.sender_name || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.reference_no || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${r.is_matched ? '✓ จับคู่แล้ว' : 'ยังไม่จับคู่'}</td>
    </tr>
  `).join('');

  const content = `
    <div style="margin-bottom:16px;background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:12px;color:#737373;">ยอดรับโอนรวม</div>
      <div style="font-size:24px;font-weight:700;">${formatCurrency(totalIncome)}</div>
      <div style="font-size:12px;color:#737373;">${records.length} รายการ</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#1a1a1a;color:white;">
          <th style="padding:10px 8px;border:1px solid #333;text-align:center;">ลำดับ</th>
          <th style="padding:10px 8px;border:1px solid #333;">วันที่</th>
          <th style="padding:10px 8px;border:1px solid #333;">เวลา</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:right;">จำนวนเงิน</th>
          <th style="padding:10px 8px;border:1px solid #333;">ผู้โอน</th>
          <th style="padding:10px 8px;border:1px solid #333;">เลขอ้างอิง</th>
          <th style="padding:10px 8px;border:1px solid #333;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#f5f5f5;font-weight:700;">
          <td colspan="3" style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">รวม</td>
          <td style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(totalIncome)}</td>
          <td colspan="3" style="border:1px solid #e5e5e5;"></td>
        </tr>
      </tbody>
    </table>
  `;

  openPrintWindow({ title, storeSettings: settings, content: getPrintHeader(settings, title) + content + getPrintFooter(settings) });
}

export function printPurchaseBillsReport(bills: PurchaseBill[], settings: StoreSettings, startDate: string, endDate: string): void {
  const totalPurchase = bills.reduce((s, b) => s + Number(b.net_amount), 0);
  const title = `รายงานบิลซื้อสินค้า (${formatDate(startDate)} - ${formatDate(endDate)})`;

  const rows = bills.map((b, i) => `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:center;">${i + 1}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${formatDate(b.bill_date)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${b.suppliers?.name || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${b.bill_number || '-'}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(b.total_amount)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;text-align:right;font-weight:600;">${formatCurrency(b.net_amount)}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${b.payment_method}</td>
      <td style="padding:8px;border:1px solid #e5e5e5;">${b.payment_status}</td>
    </tr>
  `).join('');

  const content = `
    <div style="margin-bottom:16px;background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">
      <div style="font-size:12px;color:#737373;">ยอดซื้อรวม</div>
      <div style="font-size:24px;font-weight:700;">${formatCurrency(totalPurchase)}</div>
      <div style="font-size:12px;color:#737373;">${bills.length} ใบเสร็จ</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:#1a1a1a;color:white;">
          <th style="padding:10px 8px;border:1px solid #333;text-align:center;">ลำดับ</th>
          <th style="padding:10px 8px;border:1px solid #333;">วันที่บิล</th>
          <th style="padding:10px 8px;border:1px solid #333;">คนขายส่ง</th>
          <th style="padding:10px 8px;border:1px solid #333;">เลขที่บิล</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:right;">ยอดรวม</th>
          <th style="padding:10px 8px;border:1px solid #333;text-align:right;">ยอดสุทธิ</th>
          <th style="padding:10px 8px;border:1px solid #333;">วิธีจ่าย</th>
          <th style="padding:10px 8px;border:1px solid #333;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="background:#f5f5f5;font-weight:700;">
          <td colspan="4" style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">รวม</td>
          <td style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(totalPurchase)}</td>
          <td style="padding:10px 8px;border:1px solid #e5e5e5;text-align:right;">${formatCurrency(totalPurchase)}</td>
          <td colspan="2" style="border:1px solid #e5e5e5;"></td>
        </tr>
      </tbody>
    </table>
  `;

  openPrintWindow({ title, storeSettings: settings, content: getPrintHeader(settings, title) + content + getPrintFooter(settings) });
}

function openPrintWindow(opts: PrintOptions): void {
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    alert('กรุณาอนุญาตให้เปิด popup เพื่อพิมพ์เอกสาร');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${opts.title}</title>
      <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Sarabun', sans-serif; font-size: 14px; color: #1a1a1a; line-height: 1.6; }
        .print-container { max-width: 960px; margin: 0 auto; padding: 24px; }
        @media print {
          body { font-size: 12px; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        ${opts.content}
      </div>
      <div class="no-print" style="position:fixed;bottom:20px;right:20px;display:flex;gap:8px;">
        <button onclick="window.print()" 
          style="background:#1a1a1a;color:white;border:none;padding:12px 24px;border-radius:8px;font-size:15px;font-family:Sarabun,sans-serif;cursor:pointer;">
          พิมพ์ / บันทึก PDF
        </button>
        <button onclick="window.close()" 
          style="background:white;color:#1a1a1a;border:1px solid #e5e5e5;padding:12px 24px;border-radius:8px;font-size:15px;font-family:Sarabun,sans-serif;cursor:pointer;">
          ปิด
        </button>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}
