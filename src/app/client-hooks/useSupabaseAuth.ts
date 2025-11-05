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

    const checkSession = async () => {
      try {
        console.log('[useSupabaseAuth] Checking for existing session...');

        // Check if there's an existing session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error('[useSupabaseAuth] Error getting session:', error);
        }

        if (session?.user) {
          console.log('[useSupabaseAuth] Found existing session for user:', session.user.id);
          if (!mounted) return;
          setUser(session.user);
          setIsSignedIn(true);
        } else {
          console.log('[useSupabaseAuth] No existing session found');
          if (!mounted) return;
          setUser(null);
          setIsSignedIn(false);
        }
      } catch (e) {
        console.error('[useSupabaseAuth] Error checking session:', e);
        if (!mounted) return;
        setUser(null);
        setIsSignedIn(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial session check
    void checkSession();

    // Subscribe to auth state changes (handles sign in/out events)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[useSupabaseAuth] Auth state changed:', event);
      setUser(session?.user ?? null);
      setIsSignedIn(Boolean(session?.user));
      setLoading(false);
    });

    // Handle visibility change (tab switching)
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[useSupabaseAuth] Tab became visible, refreshing session...');

        try {
          // Refresh the session when tab becomes visible
          const {
            data: { session },
            error,
          } = await supabase.auth.refreshSession();

          if (error) {
            console.error('[useSupabaseAuth] Error refreshing session:', error);
          }

          if (!mounted) return;

          if (session?.user) {
            console.log('[useSupabaseAuth] Session refreshed successfully');
            setUser(session.user);
            setIsSignedIn(true);
          } else {
            console.log('[useSupabaseAuth] No session after refresh');
            setUser(null);
            setIsSignedIn(false);
          }
        } catch (e) {
          console.error('[useSupabaseAuth] Error handling visibility change:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      subscription?.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setUser(null);
      setIsSignedIn(false);
    } catch (e) {
      console.error('[useSupabaseAuth] signOut error:', e);
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
