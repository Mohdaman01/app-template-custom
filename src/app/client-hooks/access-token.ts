'use client';
import { useSDK } from '@/app/utils/wix-sdk.client-only';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

export const useAccessToken = () => {
  const { dashboard } = useSDK();
  const searchParams = useSearchParams();
  const tokenFromSearch = searchParams.get('accessToken');

  // Memoize the promise so its identity is stable across renders.
  // Without memoization a new Promise object is created on every render which
  // can cause effects that depend on it to re-run repeatedly.
  return useMemo(
    () => (tokenFromSearch ? Promise.resolve(tokenFromSearch) : dashboard.getAccessToken?.()),
    [tokenFromSearch, dashboard.getAccessToken],
  );
};
