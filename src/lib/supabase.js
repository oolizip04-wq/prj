import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// .env.local 을 아직 안 만들었어도 앱이 멈추지 않도록, 값이 없으면 null
export const supabase = url && key ? createClient(url, key) : null
export const isSupabaseReady = Boolean(supabase)
