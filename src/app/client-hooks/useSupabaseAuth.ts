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

    // Attempt to exchange Wix token for a Supabase session
    const exchangeWixToken = async (accessToken: string) => {
      try {
        const response = await fetch('/api/auth/v1/session', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Session exchange failed: ${response.statusText}`);
        }

        const { session } = await response.json();
        if (!session?.access_token) {
          throw new Error('No session in response');
        }

        // Set the session in Supabase
        await supabase.auth.setSession(session);
        return true;
      } catch (error) {
        console.error('Error exchanging Wix token:', error);
        return false;
      }
    };

    const syncUser = async () => {
      try {
        // First try to get existing user
        const { data } = await supabase.auth.getUser();

        if (!data?.user) {
          // If no user, try to get Wix token from URL or storage
          const params = new URLSearchParams(window.location.search);
          const accessToken = params.get('accessToken');

          if (accessToken) {
            // Try to exchange the Wix token for a session
            const exchanged = await exchangeWixToken(accessToken);
            if (exchanged) {
              // Refetch user after exchange
              const { data: newData } = await supabase.auth.getUser();
              if (!mounted) return;
              setUser(newData?.user ?? null);
              setIsSignedIn(Boolean(newData?.user));
              return;
            }
          }
        }

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

          // If no user, try to get current Wix token
          if (!data?.user) {
            const params = new URLSearchParams(window.location.search);
            const accessToken = params.get('accessToken');

            if (accessToken) {
              // Try to exchange the Wix token
              const exchanged = await exchangeWixToken(accessToken);
              if (exchanged) {
                // Refetch user after exchange
                const { data: newData } = await supabase.auth.getUser();
                if (!mounted) return;
                setUser(newData?.user ?? null);
                setIsSignedIn(Boolean(newData?.user));
                return;
              }
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
