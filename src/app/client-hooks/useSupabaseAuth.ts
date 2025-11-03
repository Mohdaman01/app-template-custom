'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { useAccessToken } from './access-token';

export const useSupabaseAuth = () => {
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<any | null>(null);
  const accessTokenPromise = useAccessToken();

  // Store the resolved Wix token so we can reuse it
  const wixTokenRef = useRef<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    // Attempt to exchange Wix token for a Supabase session
    const exchangeWixToken = async (accessToken: string): Promise<boolean> => {
      try {
        console.log('[useSupabaseAuth] Exchanging Wix token for Supabase session...');
        const response = await fetch('/api/auth/v1/session', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[useSupabaseAuth] Session exchange failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorText,
          });
          return false;
        }

        const responseData = await response.json();
        console.log('[useSupabaseAuth] Session API response:', responseData);

        const { session } = responseData;
        if (!session?.access_token) {
          console.error('[useSupabaseAuth] No session in response:', responseData);
          return false;
        }

        // Set the session in Supabase - this will persist to localStorage
        const { error } = await supabase.auth.setSession(session);
        if (error) {
          console.error('[useSupabaseAuth] Error setting session:', error);
          return false;
        }

        console.log('[useSupabaseAuth] Session exchange successful');
        return true;
      } catch (error) {
        console.error('[useSupabaseAuth] Error exchanging Wix token:', error);
        return false;
      }
    };

    const syncUser = async () => {
      try {
        console.log('[useSupabaseAuth] Starting syncUser...');

        // Try to get existing user from Supabase session
        const { data, error: getUserError } = await supabase.auth.getUser();

        if (getUserError) {
          console.log('[useSupabaseAuth] Error getting user:', getUserError.message);
        }

        if (data?.user) {
          console.log('[useSupabaseAuth] Found existing Supabase session');
          if (!mounted) return;
          setUser(data.user);
          setIsSignedIn(true);
          setLoading(false);
          return;
        }

        // No existing session, get Wix token and exchange it
        console.log('[useSupabaseAuth] No existing session, getting Wix token...');
        let wixToken = await accessTokenPromise;

        // If no token in production, user needs to sign in manually
        // In development, use a bypass token
        if (!wixToken) {
          const isDev = process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost';
          if (isDev) {
            console.log('[useSupabaseAuth] No Wix token - using development bypass token');
            wixToken = 'dev-bypass-token';
          } else {
            console.log('[useSupabaseAuth] No Wix token available - user needs to sign in manually');
            if (!mounted) return;
            setUser(null);
            setIsSignedIn(false);
            setLoading(false);
            return;
          }
        }

        console.log('[useSupabaseAuth] Got Wix token (length:', wixToken.length, ')');
        if (wixToken !== 'dev-bypass-token') {
          console.log('[useSupabaseAuth] Token starts with:', wixToken.substring(0, 20) + '...');
        }

        // Store the token for later use
        wixTokenRef.current = wixToken;

        console.log('[useSupabaseAuth] Got Wix token, exchanging for session...');
        const exchanged = await exchangeWixToken(wixToken);

        if (exchanged) {
          // Refetch user after exchange
          const { data: newData } = await supabase.auth.getUser();
          if (!mounted) return;
          setUser(newData?.user ?? null);
          setIsSignedIn(Boolean(newData?.user));
          console.log('[useSupabaseAuth] Session established successfully');
        } else {
          console.log('[useSupabaseAuth] Failed to exchange token - user needs to sign in manually');
          if (!mounted) return;
          setUser(null);
          setIsSignedIn(false);
        }
      } catch (e) {
        console.error('[useSupabaseAuth] Error in syncUser:', e);
        if (!mounted) return;
        setUser(null);
        setIsSignedIn(false);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // Initial sync
    void syncUser();

    // Subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      console.log('[useSupabaseAuth] Auth state changed:', event, 'User ID:', session?.user?.id);
      setUser(session?.user ?? null);
      setIsSignedIn(Boolean(session?.user));
      setLoading(false);
    });

    // Handle visibility change (tab switching)
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        console.log('[useSupabaseAuth] Tab became visible, checking auth state...');

        try {
          // First, try to refresh the session if it exists
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

          if (sessionData?.session) {
            console.log('[useSupabaseAuth] Found existing session, checking if valid...');
            // Session exists, verify the user
            const { data, error } = await supabase.auth.getUser();

            if (!error && data?.user) {
              console.log('[useSupabaseAuth] User still signed in after visibility change');
              if (!mounted) return;
              setUser(data.user);
              setIsSignedIn(true);
              return;
            } else {
              console.log('[useSupabaseAuth] Session exists but user validation failed:', error?.message);
            }
          } else {
            console.log('[useSupabaseAuth] No session found in storage');
          }

          // No valid session, try to restore using stored Wix token
          console.log('[useSupabaseAuth] Attempting to restore using Wix token...');

          if (wixTokenRef.current) {
            console.log('[useSupabaseAuth] Using stored Wix token to create new session');
            const exchanged = await exchangeWixToken(wixTokenRef.current);
            if (exchanged) {
              const { data: newData } = await supabase.auth.getUser();
              if (!mounted) return;
              setUser(newData?.user ?? null);
              setIsSignedIn(Boolean(newData?.user));
              console.log('[useSupabaseAuth] Session restored on visibility change');
              return;
            } else {
              console.log('[useSupabaseAuth] Token exchange failed');
            }
          } else {
            console.log('[useSupabaseAuth] No stored Wix token available');
          }

          if (!mounted) return;
          setUser(null);
          setIsSignedIn(false);
          console.log('[useSupabaseAuth] Could not restore session');
        } catch (e) {
          console.error('[useSupabaseAuth] Error handling visibility change:', e);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      document.removeEventListener('visibilitychange', handleVisibility);
      listener?.subscription?.unsubscribe?.();
    };
  }, [accessTokenPromise]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      wixTokenRef.current = null;
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
