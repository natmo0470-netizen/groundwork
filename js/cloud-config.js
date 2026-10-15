/* Groundwork — cloud project settings.
   Supabase Project URL and its publishable key (Connect dialog, or Settings → API Keys).
   Both are safe to ship in the app: row-level security in server/supabase/schema.sql decides
   what each signed-in person can read or write. Never put the secret / service_role key here.
   Empty values hide every cloud feature; the app then works fully offline. */
const CLOUD_CONFIG = {
  url: 'https://eavcynlwjpwigrvfuvzd.supabase.co',
  anonKey: 'sb_publishable_uWQzbQu29-2DiaP03_fbzA_l_js2neM',
};
