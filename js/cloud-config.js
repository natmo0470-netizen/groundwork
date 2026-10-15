/* Groundwork — cloud project settings.
   Paste your Supabase Project URL and its public key (Project Settings → API: "anon public",
   or the newer "publishable" key). Both are safe to ship in the app: row-level security in
   server/supabase/schema.sql decides what each signed-in person can read or write.
   Never put the service_role / secret key here.
   Leave them empty and every cloud feature stays hidden; the app works fully offline. */
const CLOUD_CONFIG = {
  url: '',
  anonKey: '',
};
