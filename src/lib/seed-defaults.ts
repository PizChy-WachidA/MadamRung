import { supabase } from './supabase';

const DEFAULT_CATEGORIES = [
  'กระเป๋าหนัง',
  'กระเป๋าสะพาย',
  'กระเป๋าถือ',
  'กระเป๋าใส่เงิน',
  'กระเป๋าเดินทาง',
  'อุปกรณ์เสริม',
];

const DEFAULT_BANK = {
  bank_name: 'กสิกรไทย',
  account_name: 'รุ่งฤดี หังษาบุตร',
  account_number: '789-230-1063',
  account_type: 'ออมทรัพย์',
  is_primary: true,
};

const DEFAULT_STORE = {
  store_name: 'ร้านกระเป๋าหนังแท้ มาดามรุ่ง',
  owner_name: 'นางสาวรุ่ง หังษาบุตร',
  phone: '081-383-0622',
};

/**
 * Seeds default data for a new user on first login.
 * Safe to call multiple times - uses upsert/insert-if-not-exists patterns.
 */
export async function seedDefaultsForUser(userId: string): Promise<void> {
  await Promise.all([
    seedStoreSettings(userId),
    seedCategories(userId),
    seedBankAccount(userId),
  ]);
}

async function seedStoreSettings(userId: string): Promise<void> {
  // Only insert if no settings exist
  const { data: existing } = await supabase
    .from('store_settings')
    .select('id')
    .eq('user_id', userId)
    .single();
  if (existing) return;

  await supabase.from('store_settings').insert({
    user_id: userId,
    ...DEFAULT_STORE,
  });
}

async function seedCategories(userId: string): Promise<void> {
  // Only insert if no categories exist
  const { data: existing } = await supabase
    .from('product_categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (existing && existing.length > 0) return;

  await supabase.from('product_categories').insert(
    DEFAULT_CATEGORIES.map(name => ({ user_id: userId, name }))
  );
}

async function seedBankAccount(userId: string): Promise<void> {
  // Only insert if no bank accounts exist
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('id')
    .eq('user_id', userId)
    .limit(1);
  if (existing && existing.length > 0) return;

  await supabase.from('bank_accounts').insert({
    user_id: userId,
    ...DEFAULT_BANK,
  });
}
