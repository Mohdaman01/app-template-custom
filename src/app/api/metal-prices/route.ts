// src/app/api/metal-prices/route.ts - UPDATED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';

/**
 * GET /api/metal-prices?currency=USD
 *
 * Returns prices from the metal_prices table, which is updated periodically by a cron job.
 * The external API call has been disabled.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'USD';

  try {
    // Always fetch from the database
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: priceData, error } = await supabase
      .from('metal_prices')
      .select('*')
      .eq('currency', currency)
      .maybeSingle();

    if (error) {
      console.error('Failed to fetch prices from database:', error);
      return NextResponse.json(
        { error: 'Failed to fetch prices from database', details: error.message },
        { status: 500 },
      );
    }

    if (priceData) {
      const age = Date.now() - new Date(priceData.fetched_at).getTime();
      const ageHours = Math.floor(age / (1000 * 60 * 60));

      console.log(`Returning database prices for ${currency} (${ageHours}h old)`);

      return NextResponse.json(
        {
          goldPrice: priceData.gold_price,
          silverPrice: priceData.silver_price,
          platinumPrice: priceData.platinum_price,
          currency: priceData.currency,
          timestamp: priceData.api_timestamp,
          date: priceData.api_timestamp,
          fromCache: false,
          fromDatabase: true,
          fetchedAt: priceData.fetched_at,
          ageHours,
          nextUpdateIn: `${6 - ageHours} hours`,
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=21600', // 6 hours
            'X-Cache-Status': 'DATABASE',
          },
        },
      );
    } else {
      // If no data is found in the database for the currency, return an error.
      return NextResponse.json({ error: `No prices found for ${currency} in the database.` }, { status: 404 });
    }
  } catch (error) {
    console.error('Failed to fetch metal prices:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
