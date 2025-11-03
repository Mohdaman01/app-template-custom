import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Ensure the browser client persists and refreshes sessions where possible.
// This helps when the Wix dashboard iframe loses focus or is reloaded by the host
// and the auth state needs to be rehydrated on visibility change.
//
// NOTE: In iframe contexts (like Wix dashboard), cookies may be blocked by browser
// third-party cookie policies. Supabase will automatically fall back to localStorage.
export const createClient = () =>
  createBrowserClient(supabaseUrl!, supabaseKey!, {
    auth: {
      // Use localStorage for session storage (more reliable in iframes)
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'wix-app-supabase-auth',
      // persist session in available storage
      persistSession: true,
      // attempt to auto refresh tokens when needed
      autoRefreshToken: true,
      // we don't want to detect session from URL automatically in this app
      detectSessionInUrl: false,
    },
  });
