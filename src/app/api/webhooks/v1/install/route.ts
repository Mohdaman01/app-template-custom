import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/app/utils/supabase/server';
import { createSdk } from '@/app/utils/wix-sdk';
import { useAccessToken } from '@/app/client-hooks/access-token';

export async function POST(request: NextRequest) {
  console.info('Webhook::install - called');
  const { eventType, instanceId, payload } = await wixAppClient.webhooks.processRequest(request, {
    expectedEvents: [wixAppClient.webhooks.apps.AppInstalled],
  });

  const accessTokenPromise = useAccessToken();
  const accessToken = (await accessTokenPromise)!;
  console.log('accessToken:', accessToken);

  console.info('Webhook::install - input is:', {
    eventType,
    instanceId,
    payload,
  });

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
  const sdk = createSdk(accessToken);

  // Get all products
  const products = await sdk.products.queryProducts().find();

  console.log('Fetched products for extended fields initialization:', products.items.length);
  try {
    // Update each product with the extended fields using REST API
    for (const product of products.items) {
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
