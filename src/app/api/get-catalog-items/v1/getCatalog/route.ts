import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { NextRequest, NextResponse } from 'next/server';
// import * as jose from 'jose';

// async function verify(jwt: string) {
//   const alg = 'RS256';
//   const spki = process.env.WIX_APP_JWT_KEY; // Replace with your app's public key

//   try {
//     if (typeof jwt !== 'string') {
//       throw new Error('JWT must be a string');
//     }
//     if (!spki) {
//       throw new Error('Public key (WIX_APP_ID) is not defined');
//     }
//     const publicKey = await jose.importSPKI(spki, alg);
//     const { payload } = await jose.jwtVerify(jwt, publicKey, {
//       issuer: 'wix.com',
//       audience: process.env.WIX_APP_ID, // Replace with your app ID
//       maxTokenAge: 60,
//       clockTolerance: 60,
//     });
//     return payload;
//   } catch (error) {
//     throw new Error('JWT verification failed');
//   }
// }
wixAppClient.catalog.provideHandlers({
  async getCatalogItems(payload): Promise<any> {
    const { request, metadata } = payload;
    console.log('getCatalogItems called with request:', request);
    console.log('Metadata:', metadata);
    // Implement your logic to fetch catalog items based on the request
    // Use the `request` and `metadata` received from Wix and
    // apply custom logic.
    return {
      // Return your response exactly as documented to integrate with Wix.
      // Return value example:
      catalogItems: [
        {
          catalogReference: {
            appId: '3b8658a6-3282-4b5e-ae0e-439113e20aef',
            catalogItemId: '205c539b-fd89-4b0c-8d7e-55630f66e5f9',
          },
          data: {
            productName: {
              original: 'Simple Black Sun Hat',
            },
            url: '/product-page/sun-hat',
            itemType: {
              preset: 'PHYSICAL',
            },
            price: '20.00',
            physicalProperties: {
              sku: '227220141836',
              shippable: true,
            },
            media: {
              id: 'e3bc27_6edeb786f2aa44b19d9abcb4d1f6bfd6~mv2.png',
              height: 720,
              width: 720,
            },
          },
        },
      ],
    };
  },
});

export async function POST(req: NextRequest) {
  try {
    // console.log('Received request:', req);
    // const { token } = await req.json();
    // const body = await verify(token);
    // console.log('Decoded JWT payload:', body);
    // const instanceId = body.data.metadata.instanceId;
    // const requestedItems = body.data.request.catalogReferences;

    // const catalogItems = await Promise.all(requestedItems.map(async (reference) => {
    // Replace "<COLLECTION ID>" with your actual collection ID
    //   const results = await wixClient.items
    //     .query("<COLLECTION ID>")
    //     .eq("mainProductId", reference.catalogReference.catalogItemId)
    //     .find();
    //   const item = results.items[0];
    //   const options = (reference.catalogReference.options !== null) ? reference.catalogReference.options : {};

    //   return {
    //     "catalogReference": {
    //       "appId": "<YOUR APP ID>",
    //       "catalogItemId": item.mainProductId,
    //       "options": options
    //     },
    //     "data": {
    //       "productName": {
    //         "original": item.title
    //       },
    //       "itemType": {
    //         "preset": "SERVICE" // Or "PHYSICAL", "DIGITAL", etc.
    //       },
    //       "price": item.price,
    //       "priceDescription": {
    //         "original": "Number of lines"
    //       }
    //     }
    //   };
    // }));

    console.info('Catalog Plugin::POST - called');
    return wixAppClient.servicePlugins.processRequest(req);
    // NextResponse.json({
    //   catalogItems: [
    //     {
    //       catalogReference: {
    //         appId: '818f4b81-f496-4d50-813b-e44cd39a099e',
    //         catalogItemId: '205c539b-fd89-4b0c-8d7e-55630f66e5f9',
    //       },
    //       data: {
    //         productName: {
    //           original: 'Simple Black Sun Hat',
    //         },
    //         url: {
    //           relativePath: '/product-page/sun-hat',
    //           url: 'https://www.<MY_STORE>.com/',
    //         },
    //         itemType: {
    //           preset: 'PHYSICAL',
    //         },
    //         price: '20.00',
    //         physicalProperties: {
    //           sku: '227220141836',
    //           shippable: true,
    //         },
    //         media: {
    //           id: 'e3bc27_6edeb786f2aa44b19d9abcb4d1f6bfd6~mv2.png',
    //           height: 720,
    //           width: 720,
    //         },
    //       },
    //     },
    //     {
    //       catalogReference: {
    //         appId: '3b8658a6-3282-4b5e-ae0e-439113e20aef',
    //         catalogItemId: 'f95bd723-ea83-40f2-8cb8-accff2d54866',
    //         options: {
    //           color: 'Green',
    //           size: 'M',
    //         },
    //       },
    //       data: {
    //         productName: {
    //           original: 'Cotton T-shirt',
    //         },
    //         url: {
    //           relativePath: '/product-page/t-shirt',
    //           url: 'https://www.<MY_STORE>.com/',
    //         },
    //         itemType: {
    //           preset: 'PHYSICAL',
    //         },
    //         price: {
    //           amount: '80.00',
    //         },
    //         descriptionLines: [
    //           {
    //             name: {
    //               original: 'Size',
    //               translated: 'Size',
    //             },
    //             plainText: {
    //               original: 'Medium',
    //               translated: 'Medium',
    //             },
    //           },
    //           {
    //             name: {
    //               original: 'Color',
    //               translated: 'Color',
    //             },
    //             plainText: {
    //               original: 'Green',
    //               translated: 'Green',
    //             },
    //           },
    //         ],
    //         physicalProperties: {
    //           sku: '889809004958',
    //           shippable: true,
    //         },
    //         media: {
    //           id: '3258d9_77f175cc4d234714825fbf316803ca9a~mv2.png',
    //           height: 720,
    //           width: 720,
    //         },
    //       },
    //     },
    //   ],
    // });
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Failed to create plugin' }, { status: 400 });
  }
}
