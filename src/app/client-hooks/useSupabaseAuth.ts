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
    });

    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const { data } = await supabase.auth.getUser();
          if (!mounted) return;
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
