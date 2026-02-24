import { createClient } from '@supabase/supabase-js'

// Vite の環境変数を使用して Supabase を初期化
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// URL または キーが欠落している場合の警告
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase 環境変数が設定されていません。.env.local または Vercel の設定を確認してください。")
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)