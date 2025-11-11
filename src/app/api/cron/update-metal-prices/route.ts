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

    // Make a single API call with base currency (INR or USD)
    const baseCurrency = 'INR';
    console.log(`[CRON] Fetching prices in ${baseCurrency} with all currency rates`);

    const response = await fetch(`https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=${baseCurrency}&unit=g`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('API request failed');
    }

    // Extract base metal prices and currency rates
    const baseGoldPrice = data.metals.gold;
    const baseSilverPrice = data.metals.silver;
    const basePlatinumPrice = data.metals.platinum;
    const currencyRates = data.currencies;
    const apiTimestamp = data.timestamps.metal;
    const fetchedAt = new Date().toISOString();

    // Supported currencies to store
    const currencies = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY'];
    const cookieStore = await cookies();
    const supabase = createServiceClient ? createServiceClient(cookieStore) : createClient(cookieStore);

    // Calculate prices for each currency using the conversion rates
    const results = await Promise.allSettled(
      currencies.map(async (currency) => {
        try {
          console.log(`[CRON] Calculating prices for ${currency}`);

          // Get the conversion rate for this currency
          // If base is INR and we want USD, we divide by the rate (INR to USD)
          const conversionRate = currency === baseCurrency ? 1 : currencyRates[currency] || 1;

          // Calculate prices in target currency
          const goldPrice = Number((baseGoldPrice / conversionRate).toFixed(2));
          const silverPrice = Number((baseSilverPrice / conversionRate).toFixed(2));
          const platinumPrice = Number((basePlatinumPrice / conversionRate).toFixed(2));

          const priceRecord = {
            currency,
            gold_price: goldPrice,
            silver_price: silverPrice,
            platinum_price: platinumPrice,
            api_timestamp: apiTimestamp,
            fetched_at: fetchedAt,
          };

          // Upsert into metal_prices table
          const { error: upsertError } = await supabase
            .from('metal_prices')
            .upsert(priceRecord, { onConflict: 'currency' });

          if (upsertError) {
            throw new Error(`Failed to store prices for ${currency}: ${upsertError.message}`);
          }

          const updateUserPrices = await supabase
            .from('Dashboard Rules')
            .update({
              goldPrice: priceRecord.gold_price,
              silverPrice: priceRecord.silver_price,
              platinumPrice: priceRecord.platinum_price,
              last_api_update: priceRecord.fetched_at,
            })
            .eq('use_auto_pricing', true)
            .eq('pro_user', true)
            .eq('currency', currency);

          if (updateUserPrices.error) {
            throw new Error(`Failed to update user prices for ${currency}: ${updateUserPrices.error.message}`);
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
