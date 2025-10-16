'use client';
import { dashboard, SDK } from '@wix/dashboard';
import { useMemo } from 'react';
import { createClient } from '@wix/sdk/client';

function inIframe() {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

export const useSDK = () => {
  const sdk = useMemo(() => {
    if (typeof window === 'undefined' || !inIframe()) {
      // The SDK is not initialized during server-side rendering or outside an iframe, making SDK methods unusable in these contexts.
      return { dashboard: {} as SDK };
    }

    // NOTE: we intentionally do NOT include optional modules here (like '@wix/site-site')
    // to avoid bundler/runtime module resolution errors when those packages are not installed.
    // If you need the `site` module at runtime, install '@wix/site-site' and add it here.
    return createClient({
      host: dashboard.host(),
      auth: dashboard.auth(),
      modules: {
        dashboard,
      },
    });
  }, [typeof window]);
  return sdk;
};
