import { AppStrategy } from '@wix/sdk/auth/wix-app-oauth';
import { createClient } from '@wix/sdk/client';
import { products } from '@wix/stores';

export const wixAppClient = createClient({
  auth: AppStrategy({
    appId: process.env.WIX_APP_ID!,
    appSecret: process.env.WIX_APP_SECRET!,
    publicKey: process.env.WIX_APP_JWT_KEY,
  }),
  modules: { products },
});
