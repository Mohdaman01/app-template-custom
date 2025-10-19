import { wixAppClient } from '@/app/utils/wix-sdk.app';
import { type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';

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

  // Create Supabase server client using cookie store from Next headers
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Build a dashboard rule record from the webhook payload.
    // Assumption: payload contains basic site/app info. We'll store instanceId, eventType and raw payload.
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

    console.info('Webhook::install - upserted dashboard rule', upserted);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('Webhook::install - unexpected error', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}
