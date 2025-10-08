import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

async function verify(jwt: string) {
  const alg = 'RS256';
  const spki = process.env.WIX_APP_JWT_KEY; // Replace with your app's public key

  try {
    if (typeof jwt !== 'string') {
      throw new Error('JWT must be a string');
    }
    if (!spki) {
      throw new Error('Public key (WIX_APP_ID) is not defined');
    }
    const publicKey = await jose.importSPKI(spki, alg);
    const { payload } = await jose.jwtVerify(jwt, publicKey, {
      issuer: 'wix.com',
      audience: process.env.WIX_APP_ID, // Replace with your app ID
      maxTokenAge: 60,
      clockTolerance: 60,
    });
    return payload;
  } catch (error) {
    throw new Error('JWT verification failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Received request:', req);
    const { token } = await req.json();
    const body = await verify(token);
    console.log('Decoded JWT payload:', body);
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

    console.info('Shipping rates::POST - called');
    return wixAppClient.servicePlugins.processRequest(req);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json({ error: 'Failed to create plugin' }, { status: 400 });
  }
}
