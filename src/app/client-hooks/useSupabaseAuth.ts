'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/app/utils/supabase/client';

export const useSupabaseAuth = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    const syncUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        setUser(data?.user ?? null);
        setIsSignedIn(Boolean(data?.user));
      } catch (e) {
        console.error('useSupabaseAuth: error fetching user', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // initial sync
    void syncUser();

    // subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsSignedIn(Boolean(session?.user));

      // persist session into localStorage so we can attempt rehydration
      try {
        if (session) {
          // store only the tokens needed for rehydration
          const toStore = {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at,
          };
          localStorage.setItem('app_supabase_session', JSON.stringify(toStore));
        } else {
          localStorage.removeItem('app_supabase_session');
        }
      } catch (e) {
        // ignore localStorage errors (iframe storage restrictions)
      }
    });

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data } = await supabase.auth.getUser();
          if (!mounted) return;
          // if there's no user, try to rehydrate from localStorage
          if (!data?.user) {
            try {
              const raw = localStorage.getItem('app_supabase_session');
              if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed?.access_token) {
                  // attempt to set session using stored tokens
                  await supabase.auth.setSession({
                    access_token: parsed.access_token,
                    refresh_token: parsed.refresh_token,
                  });
                  const { data: newData } = await supabase.auth.getUser();
                  if (!mounted) return;
                  setUser(newData?.user ?? null);
                  setIsSignedIn(Boolean(newData?.user));
                  return;
                }
              }
            } catch (e) {
              // ignore rehydration errors
            }
          }

          setUser(data?.user ?? null);
          setIsSignedIn(Boolean(data?.user));
        } catch (e) {
          console.error('useSupabaseAuth: error re-checking user on visibilitychange', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      try {
        localStorage.removeItem('app_supabase_session');
      } catch {
        // ignore
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
