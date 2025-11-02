import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/app/utils/supabase/server';
import { createClient as wixClient } from '@wix/sdk/client';
import { AppStrategy } from '@wix/sdk/auth/wix-app-oauth';
import { products as Products, productsV3 as ProdcutsV3, catalogVersioning } from '@wix/stores';

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
    modules: { Products, ProdcutsV3, catalogVersioning },
  });

  console.log('after app client');

  const { items } = await appClient.Products.queryProducts().find();

  console.log('items from site: ', items);

  const { catalogVersion } = await appClient.catalogVersioning.getCatalogVersion();
  console.log('storeVersion is: ', catalogVersion);

  let version: 'v1' | 'v3';

  if (catalogVersion === 'V1_CATALOG') {
    version = 'v1';
  } else {
    version = 'v3';
  }

  console.log('Determined version: ', version);

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
    if (version !== 'v3') {
      throw new Error(`Unsupported catalog version: ${version}`);
    }
    // Update each product with the extended fields using REST API
    for (const product of items) {
      if (!product._id) {
        console.warn('Skipping product without ID');
        continue;
      }
      const tempProdcut = await appClient.ProdcutsV3.getProduct(product._id);
      const revision = tempProdcut.revision;

      const response = await appClient.ProdcutsV3.updateProduct(product._id, {
        revision: revision,
        extendedFields: {
          namespaces: {
            // Replace with your app's namespace from the schema plugin
            '@wixfreaks/test-shipping-example': {
              MetalType: '',
              MetalWeight: 0,
            },
          },
        },
      });

      console.log(`Updated product ${product._id} with response: `, response);

      // const response = await fetch(`https://www.wixapis.com/stores/${version}/products/${product._id}`, {
      //   method: 'PATCH',
      //   headers: {
      //     Authorization: `Bearer ${process.env.WIX_APP_SECRET!}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     product: {
      //       id: product._id,
      //       revision: revision,
      //       extendedFields: {
      //         namespaces: {
      //           // Replace with your app's namespace from the schema plugin
      //           '@wixfreaks/test-shipping-example': {
      //             MetalType: '',
      //           },
      //         },
      //       },
      //     },
      //   }),
      // });

      // if (!response) {
      //   throw new Error(`Failed to update product ${product._id}: ${await response.text()}`);
      // }
    }

    console.info('Webhook::install - initialized product extended fields');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (productsError) {
    console.error('Webhook::install - failed to initialize product extended fields', productsError);
    return new Response(JSON.stringify({ ok: false, error: String(productsError) }), { status: 500 });
  }
}
