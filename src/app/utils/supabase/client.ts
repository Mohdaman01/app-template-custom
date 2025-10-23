import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure the browser client persists and refreshes sessions where possible.
// This helps when the Wix dashboard iframe loses focus or is reloaded by the host
// and the auth state needs to be rehydrated on visibility change.
export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    auth: {
      // persist session in available storage
      persistSession: true,
      // attempt to auto refresh tokens when needed
      autoRefreshToken: true,
      // we don't want to detect session from URL automatically in this app
      detectSessionInUrl: false,
    },
  });
