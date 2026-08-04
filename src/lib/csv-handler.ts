import type { SaleRecord, BankIncomeRecord, PurchaseBill } from '@/types';
import { formatDate } from './utils';

function downloadCSV(content: string, filename: string): void {
  const bom = '\uFEFF'; // UTF-8 BOM for Thai support in Excel
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeCsvField(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(fields: (string | number | null | undefined)[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function exportSalesCSV(records: SaleRecord[], filename = 'รายการขาย.csv'): void {
  const headers = ['วันที่', 'รายการสินค้า', 'จำนวน', 'ราคาต่อชิ้น', 'ราคารวม', 'หมวดหมู่', 'หมายเหตุ', 'แหล่งที่มา'];
  const rows = records.map(r => rowToCsv([
    r.date, r.item_name, r.quantity, r.unit_price, r.total_price,
    r.category || '', r.notes || '', r.source
  ]));
  downloadCSV([headers.join(','), ...rows].join('\n'), filename);
}

export function exportBankIncomeCSV(records: BankIncomeRecord[], filename = 'รายรับบัญชี.csv'): void {
  const headers = ['วันที่', 'เวลา', 'จำนวนเงิน', 'ชื่อผู้โอน', 'เลขบัญชีผู้โอน', 'เลขอ้างอิง', 'หมายเหตุ', 'สถานะจับคู่'];
  const rows = records.map(r => rowToCsv([
    r.date, r.time_of_transfer || '', r.amount, r.sender_name || '',
    r.sender_account || '', r.reference_no || '', r.description || '',
    r.is_matched ? 'จับคู่แล้ว' : 'ยังไม่จับคู่'
  ]));
  downloadCSV([headers.join(','), ...rows].join('\n'), filename);
}

export function exportPurchaseBillsCSV(bills: PurchaseBill[], filename = 'บิลซื้อสินค้า.csv'): void {
  const headers = ['วันที่บิล', 'คนขายส่ง', 'เลขที่บิล', 'ยอดรวม', 'ส่วนลด', 'ภาษี', 'ยอดสุทธิ', 'วิธีจ่าย', 'สถานะ', 'หมายเหตุ'];
  const rows = bills.map(b => rowToCsv([
    b.bill_date, b.suppliers?.name || '', b.bill_number || '',
    b.total_amount, b.discount, b.tax_amount, b.net_amount,
    b.payment_method, b.payment_status, b.notes || ''
  ]));
  downloadCSV([headers.join(','), ...rows].join('\n'), filename);
}

export function exportSalesTemplateCSV(): void {
  const content = `date,item_name,quantity,unit_price,category,notes
2026-08-01,กระเป๋าหนังแท้ A,2,1500,กระเป๋าหนัง,ลูกค้าประจำ
2026-08-01,กระเป๋าสะพาย B,1,2200,กระเป๋าสะพาย,
2026-08-02,กระเป๋าถือ C,3,980,กระเป๋าถือ,ส่งฟรี`;
  downloadCSV(content, 'template_รายการขาย.csv');
}

export function exportBankIncomeTemplateCSV(): void {
  const content = `date,time,amount,sender_name,sender_account,reference_no,description
2026-08-01,09:30,1500,คุณสมชาย,123-456-7890,REF001,ลูกค้าประจำ
2026-08-01,14:15,2200,คุณสมหญิง,,REF002,`;
  downloadCSV(content, 'template_รายรับบัญชี.csv');
}

export function exportPurchaseBillsTemplateCSV(): void {
  const content = `bill_date,supplier_name,bill_number,item_name,quantity,unit_price,discount,tax_amount,payment_method,payment_status
2026-08-01,บริษัท หนังดี จำกัด,BILL001,หนังวัวแท้,5,500,0,0,เงินสด,จ่ายแล้ว
2026-08-01,บริษัท หนังดี จำกัด,BILL001,อะไหล่กระเป๋า,10,30,0,0,เงินสด,จ่ายแล้ว`;
  downloadCSV(content, 'template_บิลซื้อสินค้า.csv');
}

export function exportAllDataJSON(data: {
  sales: SaleRecord[];
  bankIncome: BankIncomeRecord[];
  purchaseBills: PurchaseBill[];
}): void {
  const content = JSON.stringify({
    exported_at: new Date().toISOString(),
    app: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง',
    ...data,
  }, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ImportedSaleRow {
  date: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category: string;
  notes: string;
}

export function parseSalesCSV(text: string): ImportedSaleRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const results: ImportedSaleRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    header.forEach((h, idx) => { row[h] = cols[idx] || ''; });

    const qty = parseInt(row['quantity'] || row['จำนวน'] || '1') || 1;
    const price = parseFloat(row['unit_price'] || row['ราคาต่อชิ้น'] || '0') || 0;
    const total = parseFloat(row['total_price'] || row['ราคารวม'] || '0') || qty * price;

    results.push({
      date: row['date'] || row['วันที่'] || new Date().toISOString().slice(0, 10),
      item_name: row['item_name'] || row['รายการสินค้า'] || 'ไม่ระบุ',
      quantity: qty,
      unit_price: price,
      total_price: total,
      category: row['category'] || row['หมวดหมู่'] || '',
      notes: row['notes'] || row['หมายเหตุ'] || '',
    });
  }
  return results.filter(r => r.item_name && r.item_name !== 'ไม่ระบุ');
}
