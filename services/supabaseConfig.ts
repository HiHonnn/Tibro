// =========================================================
// services/supabaseConfig.ts
// Cấu hình và khởi tạo Supabase Client cho toàn bộ ứng dụng.
// =========================================================

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Supabase cần storage bền vững để refresh token còn hiệu lực sau khi mở lại app.
import { getItem, setItem, removeItem } from '../utils/storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Thiếu EXPO_PUBLIC_SUPABASE_URL hoặc EXPO_PUBLIC_SUPABASE_ANON_KEY. Hãy sao chép .env.example thành .env.',
  );
}

// Khởi tạo Supabase Custom Adapter Storage
const customStorageAdapter = {
  getItem: (key: string) => getItem(key),
  setItem: (key: string, value: string) => setItem(key, value),
  removeItem: (key: string) => removeItem(key),
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorageAdapter as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
