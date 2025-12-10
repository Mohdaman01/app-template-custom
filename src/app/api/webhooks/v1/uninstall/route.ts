import { NextRequest } from 'next/server';
import { wixAppClient } from '@/app/utils/wix-sdk.app';

export async function POST(request: NextRequest) {
  try {
    console.info('Webhook::uninstall - called');
    const { eventType, instanceId, payload } = await wixAppClient.webhooks.processRequest(request, {
      expectedEvents: [wixAppClient.webhooks.apps.AppRemoved],
    });

    console.info('Webhook::uninstall - input is:', {
      eventType,
      instanceId,
      payload,
    });

    return new Response('OK', {
      status: 200,
    });
  } catch (err) {
    console.error('Webhook::uninstall - error occurred:', err);
    return new Response('Internal Server Error', {
      status: 500,
    });
  }
}
