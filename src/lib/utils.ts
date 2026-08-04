import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { th } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  if (isNaN(amount)) return '฿0';
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatCurrencyFull(amount: number): string {
  if (isNaN(amount)) return '฿0.00';
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(date)) return '-';
    return format(date, 'd MMM yyyy', { locale: th });
  } catch {
    return '-';
  }
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(date)) return '-';
    return format(date, 'd/M/yy', { locale: th });
  } catch {
    return '-';
  }
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    if (!isValid(date)) return '-';
    return format(date, 'd MMM yyyy HH:mm', { locale: th });
  } catch {
    return '-';
  }
}

export function formatMonthYear(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, 'MMMM yyyy', { locale: th });
  } catch {
    return dateStr;
  }
}

export function formatThaiMonth(month: number, year: number): string {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return `${months[month - 1]} ${year + 543}`;
}

export function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export function todayStart(): string {
  return startOfDay(new Date()).toISOString();
}

export function todayEnd(): string {
  return endOfDay(new Date()).toISOString();
}

export function monthStart(): string {
  return format(startOfMonth(new Date()), 'yyyy-MM-dd');
}

export function monthEnd(): string {
  return format(endOfMonth(new Date()), 'yyyy-MM-dd');
}

export function yearStart(): string {
  return format(startOfYear(new Date()), 'yyyy-MM-dd');
}

export function yearEnd(): string {
  return format(endOfYear(new Date()), 'yyyy-MM-dd');
}

export function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(format(subDays(new Date(), i), 'yyyy-MM-dd'));
  }
  return days;
}

export function dayLabel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
    return dayNames[date.getDay()];
  } catch {
    return '';
  }
}

export function parseNumber(val: string | number): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = val.replace(/[,฿\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

export function getThaiYear(): number {
  return new Date().getFullYear() + 543;
}

export function getCurrentMonthName(): string {
  const months = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
    'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
    'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];
  return months[new Date().getMonth()];
}

export function uploadImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function getPaymentStatusBadge(status: string): string {
  switch (status) {
    case 'จ่ายแล้ว': return 'badge-success';
    case 'ยังไม่จ่าย': return 'badge-danger';
    case 'จ่ายบางส่วน': return 'badge-warning';
    default: return 'badge-neutral';
  }
}

export function getOCRStatusBadge(status: string): string {
  switch (status) {
    case 'pending': return 'badge-warning';
    case 'reviewing': return 'badge-info';
    case 'approved': return 'badge-success';
    case 'rejected': return 'badge-danger';
    default: return 'badge-neutral';
  }
}

export function getOCRStatusLabel(status: string): string {
  switch (status) {
    case 'pending': return 'รอตรวจสอบ';
    case 'reviewing': return 'กำลังตรวจสอบ';
    case 'approved': return 'อนุมัติแล้ว';
    case 'rejected': return 'ยกเลิก';
    default: return status;
  }
}
