import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient, createServiceClient } from '@/app/utils/supabase/server';
import { createClient as wixClient } from '@wix/sdk/client';
import { AppStrategy } from '@wix/sdk/auth/wix-app-oauth';
import { products as Products, productsV3 as ProdcutsV3, catalogVersioning } from '@wix/stores';
import { appInstances } from '@wix/app-management';

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
    modules: { Products, ProdcutsV3, catalogVersioning, appInstances },
  });

  const appInstanceData = await appClient.appInstances.getAppInstance();

  const WIX_STORES_APP_ID = '215238eb-22a5-4c36-9e7b-e7c08025e04e';

  console.log(
    'Installed wix apps:',
    appInstanceData.site?.installedWixApps,
    'and WIX_STORES_APP_ID: ',
    WIX_STORES_APP_ID,
  );

  const hasWixStores = appInstanceData.site?.installedWixApps?.includes(WIX_STORES_APP_ID);

  if (!hasWixStores) {
    console.warn('hasWixStores if block called');
    return new Response(JSON.stringify({ ok: false, message: 'Wix Store App is not Installed' }), { status: 200 });
  }

  const { catalogVersion } = await appClient.catalogVersioning.getCatalogVersion();

  let version: 'v1' | 'v3';

  if (catalogVersion === 'V1_CATALOG') {
    version = 'v1';
  } else {
    version = 'v3';
  }

  const items = await getAllProducts(appClient, version);

  // console.log('items from site: ', items);

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
      for (const product of items) {
        if (!product._id) {
          // console.warn('Skipping product without ID');
          continue;
        }
        const existingMetalType = product.seoData?.tags?.find((tag: any) => tag.props?.name === 'MetalType');
        const existingMetalWeight = product.seoData?.tags?.find((tag: any) => tag.props?.name === 'MetalWeight');

        if (existingMetalType && existingMetalWeight) {
          // console.log(`Product ${product._id} already has SEO tags, skipping update`);
          continue;
        }
        const res = await appClient.Products.updateProduct(product._id!, {
          ...product,
          seoData: {
            tags: [
              ...(product.seoData?.tags || []),
              {
                type: 'meta',
                props: {
                  name: 'MetalType',
                  content: '',
                },
                custom: true,
                disabled: false,
              },
              {
                type: 'meta',
                props: {
                  name: 'MetalWeight',
                  content: 0,
                },
                custom: true,
                disabled: false,
              },
            ],
          },
        });
        console.log(`Updated product ${product._id} with response: `, res);
      }
      // throw new Error(`Unsupported catalog version: ${version}`);
    } else {
      // Update each product with the extended fields using REST API
      for (const product of items) {
        if (!product._id) {
          // console.warn('Skipping product without ID');
          continue;
        }
        const tempProdcut = await appClient.ProdcutsV3.getProduct(product._id);
        // console.log('tempProdcut is: ', tempProdcut);
        const revision = tempProdcut.revision;

        // Check if extended fields already exist
        const existingMetalType =
          tempProdcut?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalType;
        const existingMetalWeight =
          tempProdcut?.extendedFields?.namespaces?.['@wixfreaks/test-shipping-example']?.MetalWeight;

        if (existingMetalType !== undefined && existingMetalWeight !== undefined) {
          // console.log(`Product ${product._id} already has extended fields, skipping update`);
          continue;
        }

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

        // console.log(`Updated product ${product._id} with response: `, response);
      }
    }

    console.info('Webhook::install - initialized product extended fields');
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (productsError) {
    console.error('Webhook::install - failed to initialize product extended fields', productsError);
    return new Response(JSON.stringify({ ok: false, error: String(productsError) }), { status: 500 });
  }
}

async function getAllProducts(myClient: any, version: string) {
  let allProducts: any[] = [];
  if (version == 'v1') {
    let queryResult = await myClient.Products.queryProducts().find();

    allProducts = allProducts.concat(queryResult.items);

    while (queryResult.hasNext()) {
      queryResult = await queryResult.next(); // Fetch the next page
      allProducts = allProducts.concat(queryResult.items);
    }
  } else {
    let queryResult = await myClient.ProdcutsV3.queryProducts().find();

    allProducts = allProducts.concat(queryResult.items);

    while (queryResult.hasNext()) {
      queryResult = await queryResult.next(); // Fetch the next page
      allProducts = allProducts.concat(queryResult.items);
    }
  }

  return allProducts;
}
