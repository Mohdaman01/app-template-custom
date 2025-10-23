'use client';
import React, { useEffect, useState } from 'react';
import { Box, Button, Input, Text, FormField, Checkbox, Layout, Cell } from '@wix/design-system';
import { createClient } from '@/app/utils/supabase/client';

export const AuthSignIn = ({ onSuccess }: { onSuccess?: () => void }) => {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('supabase_remember_email');
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (remember && email) localStorage.setItem('supabase_remember_email', email);
      if (!remember) localStorage.removeItem('supabase_remember_email');
    } catch (e) {
      // ignore
    }
  }, [remember, email]);

  const validate = () => {
    if (!email) {
      setError('Please enter an email address.');
      return false;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    setError(null);
    return true;
  };

  const signIn = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else onSuccess?.();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const signUp = async () => {
    if (!validate()) return;
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else {
        // After sign up, attempt to sign in automatically. If confirmation is required
        // the sign-in may fail; caller can handle onSuccess accordingly.
        try {
          const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
          if (signInError) {
            // If sign in failed (email confirmation required), just show a helpful message
            setError('Sign up successful. Please check your email to confirm your account.');
          } else {
            onSuccess?.();
          }
        } catch (e: any) {
          setError(e?.message ?? String(e));
        }
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box direction='vertical' gap='SP6' width='100%' maxWidth={520} padding='SP6'>
      <Text weight='normal' size='medium'>
        {mode === 'signin' ? 'Sign in to Supabase' : 'Create a new account'}
      </Text>

      <Layout>
        <Cell span={12}>
          <FormField label='Email'>
            <Input
              dataHook='email-input'
              placeholder='you@company.com'
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              type='email'
            />
          </FormField>
        </Cell>
      </Layout>

      <Layout>
        <Cell span={12}>
          <FormField label='Password'>
            <Input
              dataHook='password-input'
              placeholder='At least 6 characters'
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              type='password'
            />
          </FormField>
        </Cell>
      </Layout>

      {error ? (
        <Text size='small' dataHook='auth-error' weight='normal' style={{ color: '#D92D20' }}>
          {error}
        </Text>
      ) : null}

      <Box direction='vertical' gap='SP4'>
        <Checkbox checked={remember} onChange={() => setRemember((s) => !s)} dataHook='remember-me'>
          Remember me
        </Checkbox>

        <Box direction='vertical' gap='SP2'>
          <Layout>
            <Cell span={12}>
              <Button
                priority='primary'
                onClick={mode === 'signin' ? signIn : signUp}
                disabled={loading}
                dataHook={mode === 'signin' ? 'signin-btn' : 'signup-btn'}
                stretch
              >
                {loading
                  ? mode === 'signin'
                    ? 'Signing in...'
                    : 'Creating...'
                  : mode === 'signin'
                    ? 'Sign in'
                    : 'Create account'}
              </Button>
            </Cell>
          </Layout>

          <Layout>
            <Cell span={12}>
              <Button
                skin='standard'
                onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
                disabled={loading}
                dataHook='toggle-mode-btn'
                stretch
              >
                {mode === 'signin' ? 'Sign up' : 'Back to sign in'}
              </Button>
            </Cell>
          </Layout>
        </Box>
      </Box>
    </Box>
  );
};
