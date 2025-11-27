import { type NextRequest } from 'next/server';
import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { cookies } from 'next/headers';
import { createServiceClient } from '@/app/utils/supabase/server';

wixAppClient.appInstances.onAppInstancePlanReactivated(async (event) => {
  console.log(`onAppInstancePlanReactivated invoked with data:`, event);
  console.log(`App instance ID:`, event.metadata.instanceId);
  const catalogVersion = wixAppClient.catalogVersioning.getCatalogVersion();

  try {
    const cookieStore = cookies();
    const supabase = createServiceClient(cookieStore);

    // Update the Dashboard Rules table
    const { data, error } = await supabase
      .from('Dashboard Rules')
      .update({
        plan_status: 'active',
        pro_plan_purchased_timestamp: event.data.operationTimeStamp,
        plan_id: event.data.vendorProductId,
        payment_cycle: event.data.cycle,
        plan_expire_at: event.data.expiresOn,
        renewal_reason: event.data.reason,
        cancelled_at: null,
        cancellation_reason: null,
      })
      .eq('instance_id', event.metadata.instanceId);

    if (error) {
      console.error('Error updating Dashboard Rules:', error);
      await supabase.from('Error Logs').insert({
        message: error.message,
        store_catalog_version: catalogVersion,
        instance_id: event.metadata.instanceId,
      });
    } else {
      console.log('Successfully updated Dashboard Rules for instance:', event.metadata.instanceId);
      console.log('Updated rows:', data);
    }
  } catch (err) {
    console.error('Error in webhook handler:', err);
  }
});

export async function POST(request: NextRequest) {
  console.info('Webhook::proPlanRenewal - called');
  try {
    await wixAppClient.webhooks.processRequest(request);
  } catch (err) {
    console.error(err);
    new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
    return;
  }

  return new Response('Webhook received', { status: 200 });
}
