import { type NextRequest } from 'next/server';
import { wixAppClient } from '@/app/utils/wix-sdk.app';

wixAppClient.appInstances.onAppInstancePaidPlanPurchased((event) => {
  console.log(`onAppInstancePaidPlanPurchased invoked with data:`, event);
  console.log(`App instance ID:`, event.metadata.instanceId);
  //
  // handle your event here
  //
});

export async function POST(request: NextRequest) {
  console.info('Webhook::proPlanPurchased - called');
  try {
    await wixAppClient.webhooks.processRequest(request);
  } catch (err) {
    console.error(err);
    new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
    return;
  }

  console.info('Webhook::install - input is:');
  return new Response('Webhook received', { status: 200 });
}
