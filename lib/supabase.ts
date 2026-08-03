import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://tyfacrovbcwpnuudqeus.supabase.co'
const supabaseAnonKey = 'sb_publishable_uwAtdt5ZWeE_CQy9J6H_KA_0DrasmPJ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
