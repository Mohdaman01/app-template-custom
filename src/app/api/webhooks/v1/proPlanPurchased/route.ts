import { type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  console.info('Webhook::proPlanPurchased - called');
  return new Response('Webhook received', { status: 200 });
}
