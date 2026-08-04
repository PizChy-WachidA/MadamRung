import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, HeadingLevel, AlignmentType, WidthType, BorderStyle,
  Header, Footer, PageNumber, NumberFormat, ShadingType,
} from 'docx';
import { formatCurrency, formatDate, formatThaiMonth } from './utils';
import type { SaleRecord, BankIncomeRecord, PurchaseBill, StoreSettings } from '@/types';

function thaiDateNow(): string {
  const d = new Date();
  const months = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
                  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function headerParagraphs(settings: StoreSettings, reportTitle: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: settings.store_name, bold: true, size: 44 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `ผู้ประกอบการ: ${settings.owner_name}`, size: 26, color: '525252' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    }),
    ...(settings.phone ? [new Paragraph({
      children: [new TextRun({ text: `โทร: ${settings.phone}`, size: 24, color: '525252' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    })] : []),
    ...(settings.address ? [new Paragraph({
      children: [new TextRun({ text: settings.address, size: 24, color: '525252' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
    })] : []),
    new Paragraph({
      children: [new TextRun({ text: reportTitle, bold: true, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `วันที่พิมพ์: ${thaiDateNow()}`, size: 22, color: '737373' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 3, color: '1a1a1a' } },
    }),
  ];
}

function footerParagraphs(settings: StoreSettings): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: 'หมายเหตุ: เอกสารนี้จัดทำจากสมุดบันทึกการขายต้นฉบับของร้าน', size: 20, color: '737373', italics: true })],
      spacing: { before: 400, after: 600 },
      border: { top: { style: BorderStyle.SINGLE, size: 1, color: 'e5e5e5' } },
    }),
    new Paragraph({
      children: [new TextRun({ text: `ลงชื่อ ..........................................................    ${settings.owner_name}`, size: 24 })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [new TextRun({ text: 'วันที่ ..........................................................', size: 24, color: '737373' })],
    }),
  ];
}

function makeCellText(text: string, opts?: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; bg?: string; color?: string; size?: number }): TableCell {
  const para = new Paragraph({
    children: [new TextRun({ text, bold: opts?.bold, size: opts?.size || 22, color: opts?.color })],
    alignment: opts?.align ?? AlignmentType.LEFT,
  });
  const cell = new TableCell({
    children: [para],
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    shading: opts?.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
  });
  return cell;
}

export async function exportSalesWord(
  records: SaleRecord[],
  settings: StoreSettings,
  startDate: string,
  endDate: string
): Promise<void> {
  const totalSales = records.reduce((s, r) => s + Number(r.total_price), 0);
  const totalItems = records.reduce((s, r) => s + Number(r.quantity), 0);
  const title = `รายงานสรุปยอดขาย (${formatDate(startDate)} - ${formatDate(endDate)})`;

  const headerRow = new TableRow({
    children: [
      makeCellText('ลำดับ', { bold: true, align: AlignmentType.CENTER, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('วันที่', { bold: true, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('รายการสินค้า', { bold: true, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('จำนวน', { bold: true, align: AlignmentType.CENTER, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('ราคา/ชิ้น', { bold: true, align: AlignmentType.RIGHT, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('ยอดรวม', { bold: true, align: AlignmentType.RIGHT, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('หมวดหมู่', { bold: true, bg: '1a1a1a', color: 'FFFFFF' }),
      makeCellText('หมายเหตุ', { bold: true, bg: '1a1a1a', color: 'FFFFFF' }),
    ],
    tableHeader: true,
  });

  const dataRows = records.map((r, i) => new TableRow({
    children: [
      makeCellText(String(i + 1), { align: AlignmentType.CENTER, bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(formatDate(r.date), { bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(r.item_name, { bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(String(r.quantity), { align: AlignmentType.CENTER, bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(formatCurrency(r.unit_price), { align: AlignmentType.RIGHT, bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(formatCurrency(r.total_price), { align: AlignmentType.RIGHT, bold: true, bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(r.category || '-', { bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
      makeCellText(r.notes || '-', { bg: i % 2 === 0 ? 'FFFFFF' : 'FAFAFA' }),
    ],
  }));

  const totalRow = new TableRow({
    children: [
      makeCellText('', { bg: 'F5F5F5' }),
      makeCellText('', { bg: 'F5F5F5' }),
      makeCellText('', { bg: 'F5F5F5' }),
      makeCellText('', { bg: 'F5F5F5' }),
      makeCellText('ยอดรวม', { bold: true, align: AlignmentType.RIGHT, bg: 'F5F5F5' }),
      makeCellText(formatCurrency(totalSales), { bold: true, align: AlignmentType.RIGHT, bg: 'F5F5F5' }),
      makeCellText('', { bg: 'F5F5F5' }),
      makeCellText('', { bg: 'F5F5F5' }),
    ],
  });

  const summaryRows = [
    new Paragraph({ children: [new TextRun({ text: `ยอดขายรวม: ${formatCurrency(totalSales)}`, bold: true, size: 28 })], spacing: { before: 300, after: 120 } }),
    new Paragraph({ children: [new TextRun({ text: `จำนวนรายการ: ${records.length} รายการ`, size: 24 })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `จำนวนสินค้า: ${totalItems} ชิ้น`, size: 24 })], spacing: { after: 80 } }),
    new Paragraph({ children: [new TextRun({ text: `เฉลี่ยต่อรายการ: ${records.length > 0 ? formatCurrency(totalSales / records.length) : '฿0'}`, size: 24 })], spacing: { after: 300 } }),
  ];

  const doc = new Document({
    sections: [{
      properties: {},
      headers: {
        default: new Header({
          children: [new Paragraph({
            children: [new TextRun({ text: settings.store_name, bold: true, size: 20, color: '737373' })],
            alignment: AlignmentType.RIGHT,
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            children: [
              new TextRun({ text: 'หน้าที่ ', size: 18, color: '737373' }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '737373' }),
            ],
            alignment: AlignmentType.CENTER,
          })],
        }),
      },
      children: [
        ...headerParagraphs(settings, title),
        ...summaryRows,
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, totalRow],
        }),
        ...footerParagraphs(settings),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายงานขาย_${startDate}_${endDate}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function exportProfitLossWord(
  data: { totalSales: number; totalBankIncome: number; totalPurchase: number; month?: number; year?: number },
  settings: StoreSettings
): Promise<void> {
  const totalRevenue = data.totalSales + data.totalBankIncome;
  const grossProfit = totalRevenue - data.totalPurchase;
  const profitPct = totalRevenue > 0 ? (grossProfit / totalRevenue * 100).toFixed(1) : '0';
  const periodLabel = data.month && data.year ? formatThaiMonth(data.month, data.year) : 'ช่วงที่เลือก';
  const title = `รายงานกำไร-ขาดทุน ${periodLabel}`;

  const plTable = new Table({
    width: { size: 60, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        makeCellText('รายได้จากการขาย', { bold: true, size: 28, bg: 'F5F5F5' }),
        makeCellText(formatCurrency(totalRevenue), { bold: true, align: AlignmentType.RIGHT, size: 28, bg: 'F5F5F5' }),
      ]}),
      new TableRow({ children: [
        makeCellText('  - เงินสด', { size: 24 }),
        makeCellText(formatCurrency(data.totalSales), { align: AlignmentType.RIGHT, size: 24 }),
      ]}),
      new TableRow({ children: [
        makeCellText('  - รับโอน', { size: 24 }),
        makeCellText(formatCurrency(data.totalBankIncome), { align: AlignmentType.RIGHT, size: 24 }),
      ]}),
      new TableRow({ children: [
        makeCellText('ต้นทุนสินค้า', { bold: true, size: 28, bg: 'FFF3F3' }),
        makeCellText(`-${formatCurrency(data.totalPurchase)}`, { bold: true, align: AlignmentType.RIGHT, size: 28, bg: 'FFF3F3', color: 'DC2626' }),
      ]}),
      new TableRow({ children: [
        makeCellText('กำไรขั้นต้น', { bold: true, size: 32, bg: 'E8F5E9' }),
        makeCellText(formatCurrency(grossProfit), { bold: true, align: AlignmentType.RIGHT, size: 32, bg: 'E8F5E9', color: grossProfit >= 0 ? '16a34a' : 'DC2626' }),
      ]}),
      new TableRow({ children: [
        makeCellText('กำไร %', { size: 24 }),
        makeCellText(`${profitPct}%`, { align: AlignmentType.RIGHT, size: 24, bold: true }),
      ]}),
    ],
  });

  const doc = new Document({
    sections: [{
      children: [
        ...headerParagraphs(settings, title),
        plTable,
        ...footerParagraphs(settings),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `รายงานกำไรขาดทุน_${periodLabel}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
