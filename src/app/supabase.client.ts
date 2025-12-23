import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cxpibuhinmkvckcgfiwl.supabase.co';
const supabaseAnonKey = 'sb_publishable_NeC4ct9hCKXNscvJv8nCeg_v06TwV7O';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
                                                                                