const SUPABASE_URL = "https://wagogslylsxwytorhvwt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_u45fK2vBNS_sGviUZt9Vng_TeFCfO20";

if (typeof supabase !== 'undefined') {
    window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("[LingoBot] Supabase client initialized.");
} else {
    console.error("[LingoBot] Supabase SDK not found.");
}
