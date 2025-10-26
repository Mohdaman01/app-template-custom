import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/app/utils/supabase/server';
import { createSdk } from '@/app/utils/wix-sdk';
import { createClient as wixClient } from '@wix/sdk/client';
import { AppStrategy } from '@wix/sdk/auth/wix-app-oauth';
import { products as Products } from '@wix/stores';

export async function POST(request: NextRequest) {
  console.info('Webhook::install - called');
  const { eventType, instanceId, payload } = await wixAppClient.webhooks.processRequest(request, {
    expectedEvents: [wixAppClient.webhooks.apps.AppInstalled],
  });

  console.info('Webhook::install - input is:', {
    eventType,
    instanceId,
    payload,
  });

  console.log('Before appClient');

  const appClient = wixClient({
    auth: AppStrategy({
      appId: process.env.WIX_APP_ID!,
      appSecret: process.env.WIX_APP_SECRET!,
      publicKey: process.env.WIX_APP_JWT_KEY,
      instanceId: instanceId,
    }),
    modules: { Products },
  });

  console.log('after app client');

  const { items } = await appClient.Products.queryProducts().limit(4).find();

  console.log('items from site: ', items);

  try {
    // First, create the dashboard rule
    const cookieStore = await cookies();
    const supabase = createServiceClient ? createServiceClient(cookieStore) : createClient(cookieStore);

    const rule = {
      event_type: eventType,
      instance_id: instanceId ?? null,
    } as any;

    const { data: upserted, error } = await supabase
      .from('Dashboard Rules')
      .upsert(rule as unknown as Record<string, any>, { onConflict: 'instance_id' })
      .select();

    if (error) {
      console.error('Webhook::install - failed to upsert dashboard rule', error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }
  } catch (err) {
    console.error('Webhook::install - unexpected error', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }

  // For webhook calls, we can use the app secret directly since this is server-to-server
  try {
    // Update each product with the extended fields using REST API
    for (const product of items) {
      const response = await fetch(`https://www.wixapis.com/stores/v3/products/${product._id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${process.env.WIX_APP_SECRET!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extendedFields: {
            namespaces: {
              // Replace with your app's namespace from the schema plugin
              '@wixfreaks/test-shipping-example': {
                MetalType: '',
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update product ${product._id}: ${await response.text()}`);
      }
    }

    console.info('Webhook::install - initialized product extended fields');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (productsError) {
    console.error('Webhook::install - failed to initialize product extended fields', productsError);
    return new Response(JSON.stringify({ ok: false, error: String(productsError) }), { status: 500 });
  }
}
