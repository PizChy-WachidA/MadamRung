export interface AuthUser {
  id: string;
  email: string;
  username: string;
  avatar?: string;
}

export interface StoreSettings {
  id: string;
  user_id: string;
  store_name: string;
  owner_name: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  logo_url?: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface SaleRecord {
  id: string;
  user_id: string;
  date: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
  notes?: string;
  source: 'manual' | 'ocr';
  image_url?: string;
  ocr_job_id?: string;
  created_at: string;
  updated_at: string;
}

export interface OCREntry {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface OCRJob {
  id: string;
  user_id: string;
  image_url: string;
  raw_text?: string;
  parsed_data?: {
    date?: string | null;
    entries: OCREntry[];
    daily_total?: number;
    sender_name?: string;
    amount?: number;
    time?: string;
    reference_no?: string;
    supplier_name?: string;
    bill_number?: string;
    items?: OCREntry[];
  };
  ocr_type: 'notebook' | 'slip' | 'bill';
  status: 'pending' | 'reviewing' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  user_id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  account_type: string;
  is_primary: boolean;
  created_at: string;
}

export interface BankIncomeRecord {
  id: string;
  user_id: string;
  date: string;
  time_of_transfer?: string;
  bank_account_id?: string;
  sender_name?: string;
  sender_account?: string;
  amount: number;
  description?: string;
  reference_no?: string;
  is_matched: boolean;
  matched_sale_id?: string;
  source: 'manual' | 'slip_ocr';
  slip_image_url?: string;
  created_at: string;
  bank_accounts?: BankAccount;
}

export interface Supplier {
  id: string;
  user_id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  address?: string;
  tax_id?: string;
  notes?: string;
  created_at: string;
}

export interface PurchaseBillItem {
  id?: string;
  purchase_bill_id?: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  category?: string;
}

export interface PurchaseBill {
  id: string;
  user_id: string;
  bill_date: string;
  supplier_id?: string;
  bill_number?: string;
  total_amount: number;
  discount: number;
  tax_amount: number;
  net_amount: number;
  payment_method: string;
  payment_status: string;
  notes?: string;
  bill_image_url?: string;
  source: 'manual' | 'bill_ocr';
  created_at: string;
  suppliers?: Supplier;
  purchase_bill_items?: PurchaseBillItem[];
}

export interface LoanDocument {
  id: string;
  user_id: string;
  title: string;
  store_photo_url?: string;
  interior_photo_url?: string;
  additional_docs: string[];
  report_period_start?: string;
  report_period_end?: string;
  status: 'draft' | 'ready' | 'submitted';
  created_at: string;
}

export interface DashboardData {
  todaySales: number;
  todayBankIncome: number;
  todayPurchase: number;
  todayProfit: number;
  monthSales: number;
  monthBankIncome: number;
  yearSales: number;
  pendingOCR: number;
  unpaidBills: number;
  recentSales: SaleRecord[];
  weeklySales: { date: string; label: string; amount: number }[];
}

export interface ReportSaleRow {
  date: string;
  total_sales: number;
  total_items: number;
  record_count: number;
}

export interface ProfitRow {
  date: string;
  total_sales: number;
  total_bank: number;
  total_purchase: number;
  gross_profit: number;
}
