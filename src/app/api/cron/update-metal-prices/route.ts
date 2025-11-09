// src/app/api/cron/update-metal-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServiceClient, createClient } from '@/app/utils/supabase/server';

/**
 * Background job to fetch and store metal prices every 6 hours.
 * This route should be called by a cron service (e.g., Vercel Cron, GitHub Actions, or external cron-job.org).
 *
 * Set up cron to call: POST /api/cron/update-metal-prices
 * Recommended schedule: "0 *\/6 * * *" (every 6 hours)
 *
 * For Vercel Cron, add to vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/update-metal-prices",
 *     "schedule": "0 * 6 * * *"
 *   }]
 * }
 *
 * Security: Protect this endpoint with a secret token in production
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret to prevent unauthorized calls
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.error('Unauthorized cron job attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const apiKey = process.env.METAL_PRICE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Metal price API not configured' }, { status: 503 });
    }

    console.log('[CRON] Starting metal prices update job');

    // Fetch prices for all supported currencies
    const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY'];
    const cookieStore = await cookies();
    const supabase = createServiceClient ? createServiceClient(cookieStore) : createClient(cookieStore);

    const results = await Promise.allSettled(
      currencies.map(async (currency) => {
        try {
          console.log(`[CRON] Fetching prices for ${currency}`);

          const response = await fetch(
            `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=${currency}&unit=g`,
            { cache: 'no-store' },
          );

          if (!response.ok) {
            throw new Error(`API responded with status: ${response.status}`);
          }

          const data = await response.json();

          if (data.status !== 'success') {
            throw new Error(`API request failed for ${currency}`);
          }

          const priceRecord = {
            currency,
            gold_price: Number(data.metals.gold.toFixed(2)),
            silver_price: Number(data.metals.silver.toFixed(2)),
            platinum_price: Number(data.metals.platinum.toFixed(2)),
            api_timestamp: data.timestamps.metal,
            fetched_at: new Date().toISOString(),
          };

          // Upsert into metal_prices table
          const { error: upsertError } = await supabase
            .from('metal_prices')
            .upsert(priceRecord, { onConflict: 'currency' });

          if (upsertError) {
            throw new Error(`Failed to store prices for ${currency}: ${upsertError.message}`);
          }

          console.log(`[CRON] Successfully updated prices for ${currency}`);
          return { currency, success: true };
        } catch (error) {
          console.error(`[CRON] Failed to update prices for ${currency}:`, error);
          return { currency, success: false, error: String(error) };
        }
      }),
    );

    const successful = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`[CRON] Metal prices update completed: ${successful} successful, ${failed} failed`);

    return NextResponse.json({
      success: true,
      message: `Updated prices for ${successful}/${results.length} currencies`,
      results: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: r.reason })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[CRON] Fatal error in metal prices update:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update metal prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}

// Allow GET for manual testing (remove in production or add auth)
export async function GET(request: NextRequest) {
  // Forward to POST for testing purposes
  return POST(request);
}
