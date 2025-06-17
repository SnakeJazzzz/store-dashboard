// frontend/src/lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

// These env vars are exposed because they start with NEXT_PUBLIC_
const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)