// import { createBrowserClient } from '@supabase/ssr';

// const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// // Ensure the browser client persists and refreshes sessions where possible.
// // This helps when the Wix dashboard iframe loses focus or is reloaded by the host
// // and the auth state needs to be rehydrated on visibility change.
// export const createClient = () =>
//   createBrowserClient(supabaseUrl!, supabaseKey!, {
//     auth: {
//       // persist session in available storage
//       persistSession: true,
//       // attempt to auto refresh tokens when needed
//       autoRefreshToken: true,
//       // we don't want to detect session from URL automatically in this app
//       detectSessionInUrl: false,
//     },
//   });

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a singleton client instance
let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export const createClient = () => {
  // Return existing instance if available
  if (clientInstance) {
    return clientInstance;
  }

  clientInstance = createBrowserClient(supabaseUrl!, supabaseKey!, {
    auth: {
      // Persist session - will use localStorage if available, falls back gracefully
      persistSession: true,

      // Auto refresh tokens - critical for iframe environments
      autoRefreshToken: true,

      // Don't detect session from URL in dashboard context
      detectSessionInUrl: false,

      // Storage key for session
      storageKey: 'app_supabase_auth',

      // Custom storage with fallback handling
      storage: {
        getItem: (key: string) => {
          try {
            return localStorage.getItem(key);
          } catch (e) {
            // localStorage blocked, return null
            return null;
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
          } catch (e) {
            // localStorage blocked, fail silently
            console.warn('Storage blocked, session may not persist');
          }
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key);
          } catch (e) {
            // Fail silently
          }
        },
      },
    },

    // Add global headers if needed
    global: {
      headers: {
        'X-Client-Info': 'wix-dashboard-app',
      },
    },
  });

  return clientInstance;
};

// Optional: Reset client (useful for testing or sign out)
export const resetClient = () => {
  clientInstance = null;
};
