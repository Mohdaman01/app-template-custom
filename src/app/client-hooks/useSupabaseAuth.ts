// 'use client';
// import { useEffect, useState, useCallback } from 'react';
// import { createClient } from '@/app/utils/supabase/client';

// export const useSupabaseAuth = () => {
//   const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
//   const [loading, setLoading] = useState<boolean>(true);
//   const [user, setUser] = useState<any | null>(null);

//   useEffect(() => {
//     const supabase = createClient();
//     let mounted = true;

//     const syncUser = async () => {
//       try {
//         const { data } = await supabase.auth.getUser();
//         if (!mounted) return;
//         setUser(data?.user ?? null);
//         setIsSignedIn(Boolean(data?.user));
//       } catch (e) {
//         console.error('useSupabaseAuth: error fetching user', e);
//       } finally {
//         if (mounted) setLoading(false);
//       }
//     };

//     // initial sync
//     void syncUser();

//     // subscribe to auth state changes
//     const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
//       if (!mounted) return;
//       setUser(session?.user ?? null);
//       setIsSignedIn(Boolean(session?.user));

//       // persist session into localStorage so we can attempt rehydration
//       try {
//         if (session) {
//           // store only the tokens needed for rehydration
//           const toStore = {
//             access_token: session.access_token,
//             refresh_token: session.refresh_token,
//             expires_at: session.expires_at,
//           };
//           localStorage.setItem('app_supabase_session', JSON.stringify(toStore));
//         } else {
//           localStorage.removeItem('app_supabase_session');
//         }
//       } catch (e) {
//         // ignore localStorage errors (iframe storage restrictions)
//       }
//     });

//     const handleVisibility = async () => {
//       if (document.visibilityState === 'visible') {
//         try {
//           const { data } = await supabase.auth.getUser();
//           if (!mounted) return;
//           // if there's no user, try to rehydrate from localStorage
//           if (!data?.user) {
//             try {
//               const raw = localStorage.getItem('app_supabase_session');
//               if (raw) {
//                 const parsed = JSON.parse(raw);
//                 if (parsed?.access_token) {
//                   // attempt to set session using stored tokens
//                   await supabase.auth.setSession({
//                     access_token: parsed.access_token,
//                     refresh_token: parsed.refresh_token,
//                   });
//                   const { data: newData } = await supabase.auth.getUser();
//                   if (!mounted) return;
//                   setUser(newData?.user ?? null);
//                   setIsSignedIn(Boolean(newData?.user));
//                   return;
//                 }
//               }
//             } catch (e) {
//               // ignore rehydration errors
//             }
//           }

//           setUser(data?.user ?? null);
//           setIsSignedIn(Boolean(data?.user));
//         } catch (e) {
//           console.error('useSupabaseAuth: error re-checking user on visibilitychange', e);
//         }
//       }
//     };

//     document.addEventListener('visibilitychange', handleVisibility);

//     return () => {
//       mounted = false;
//       document.removeEventListener('visibilitychange', handleVisibility);
//       listener?.subscription?.unsubscribe?.();
//     };
//   }, []);

//   const signOut = useCallback(async () => {
//     try {
//       const supabase = createClient();
//       await supabase.auth.signOut();
//       try {
//         localStorage.removeItem('app_supabase_session');
//       } catch {
//         // ignore
//       }
//       setUser(null);
//       setIsSignedIn(false);
//     } catch (e) {
//       console.error('useSupabaseAuth: signOut error', e);
//       throw e;
//     }
//   }, []);

//   return {
//     isSignedIn,
//     loading,
//     user,
//     signOut,
//   };
// };

'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Session } from '@supabase/supabase-js';

// In-memory session cache as fallback when localStorage is blocked
let memorySessionCache: {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
} | null = null;

export const useSupabaseAuth = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to save session with fallback to memory
  const saveSession = useCallback((session: any) => {
    if (!session) {
      try {
        localStorage.removeItem('app_supabase_session');
      } catch (e) {
        // ignore
      }
      memorySessionCache = null;
      return;
    }

    const toStore = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    };

    // Try localStorage first
    try {
      localStorage.setItem('app_supabase_session', JSON.stringify(toStore));
    } catch (e) {
      console.warn('localStorage blocked, using memory cache');
    }

    // Always save to memory as backup
    memorySessionCache = toStore;
  }, []);

  // Helper to load session with fallback to memory
  const loadSession = useCallback((): typeof memorySessionCache => {
    // Try localStorage first
    try {
      const raw = localStorage.getItem('app_supabase_session');
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      // localStorage blocked or failed
    }

    // Fallback to memory cache
    return memorySessionCache;
  }, []);

  // Restore session from storage
  const restoreSession = useCallback(
    async (supabase: ReturnType<typeof createClient>) => {
      const stored = loadSession();
      if (stored?.access_token) {
        try {
          const { data, error } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          });

          if (!error && data?.session) {
            return data.session;
          }
        } catch (e) {
          console.error('Failed to restore session:', e);
        }
      }
      return null;
    },
    [loadSession],
  );

  // Proactive token refresh
  const setupTokenRefresh = useCallback(
    (expiresAt?: number) => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      if (!expiresAt) return;

      // Refresh 5 minutes before expiry
      const refreshTime = expiresAt * 1000 - Date.now() - 5 * 60 * 1000;

      if (refreshTime > 0) {
        refreshIntervalRef.current = setTimeout(async () => {
          try {
            const supabase = createClient();
            const { data } = await supabase.auth.refreshSession();
            if (data?.session) {
              saveSession(data.session);
              setupTokenRefresh(data.session.expires_at);
            }
          } catch (e) {
            console.error('Token refresh failed:', e);
          }
        }, refreshTime);
      }
    },
    [saveSession],
  );

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const syncUser = async () => {
      try {
        // Try to get current user
        let { data } = await supabase.auth.getUser();

        // If no user, try to restore from storage
        if (!data?.user) {
          const restoredSession = await restoreSession(supabase);
          if (restoredSession) {
            const { data: userData } = await supabase.auth.getUser();
            data = userData;
          }
        }

        if (!mounted) return;

        setUser(data?.user ?? null);
        setIsSignedIn(Boolean(data?.user));

        // Get current session for token refresh
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          saveSession(sessionData.session);
          setupTokenRefresh(sessionData.session.expires_at);
        }
      } catch (e) {
        console.error('useSupabaseAuth: error fetching user', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial sync
    void syncUser();

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event: 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED', session: Session | null) => {
        if (!mounted) return;

        setUser(session?.user ?? null);
        setIsSignedIn(Boolean(session?.user));
        saveSession(session);

        if (session?.expires_at) {
          setupTokenRefresh(session.expires_at);
        }
      },
    );

    // Handle visibility change and page focus
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          // Check if session is still valid
          const { data } = await supabase.auth.getUser();

          if (!mounted) return;

          // If no user, try to restore
          if (!data?.user) {
            const restoredSession = await restoreSession(supabase);
            if (restoredSession) {
              const { data: newData } = await supabase.auth.getUser();
              if (!mounted) return;
              setUser(newData?.user ?? null);
              setIsSignedIn(Boolean(newData?.user));
              return;
            }
          }

          setUser(data?.user ?? null);
          setIsSignedIn(Boolean(data?.user));
        } catch (e) {
          console.error('useSupabaseAuth: error on visibility change', e);
        }
      }
    };

    // Handle page focus (works better than visibilitychange in some cases)
    const handleFocus = () => {
      handleVisibility();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
      listener?.subscription?.unsubscribe?.();

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [restoreSession, saveSession, setupTokenRefresh]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();

      try {
        localStorage.removeItem('app_supabase_session');
      } catch {
        // ignore
      }

      memorySessionCache = null;

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }

      setUser(null);
      setIsSignedIn(false);
    } catch (e) {
      console.error('useSupabaseAuth: signOut error', e);
      throw e;
    }
  }, []);

  return {
    isSignedIn,
    loading,
    user,
    signOut,
  };
};
