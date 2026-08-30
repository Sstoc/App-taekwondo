import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ihxvrsdyxhslwahkklmh.supabase.co'
const SUPABASE_KEY = 'sb_publishable_iCPuyn5_jTXvtPl4zwwbVA_uf-F3W05'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
