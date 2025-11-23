import { type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  console.info('Webhook::pro - called');
  return new Response('Webhook received', { status: 200 });
}
