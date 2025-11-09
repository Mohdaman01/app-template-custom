// src/app/api/metal-prices/route.ts - UPDATED VERSION
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/app/utils/supabase/server';

// In-memory cache for metal prices (fallback when not using database)
interface CachedPrices {
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
  currency: string;
  timestamp: string;
  cachedAt: number;
}

const priceCache = new Map<string, CachedPrices>();
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * GET /api/metal-prices?currency=USD&useDatabase=true
 *
 * If useDatabase=true, returns prices from the metal_prices table (updated every 6 hours by cron)
 * Otherwise, uses the old in-memory cache with direct API calls
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'USD';
  const useDatabase = searchParams.get('useDatabase') === 'true';

  try {
    // NEW: Return from database if useDatabase flag is set
    if (useDatabase) {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);

      const { data: priceData, error } = await supabase
        .from('metal_prices')
        .select('*')
        .eq('currency', currency)
        .maybeSingle();

      if (error) {
        console.error('Failed to fetch prices from database:', error);
        // Fall back to API if database fails
      } else if (priceData) {
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
      }
    }

    // EXISTING: In-memory cache logic (unchanged)
    const cacheKey = `prices_${currency}`;
    const cached = priceCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < CACHE_DURATION_MS) {
      console.log(`Returning cached prices for ${currency}`);
      return NextResponse.json(
        {
          goldPrice: cached.goldPrice,
          silverPrice: cached.silverPrice,
          platinumPrice: cached.platinumPrice,
          currency: cached.currency,
          timestamp: cached.timestamp,
          date: cached.timestamp,
          fromCache: true,
          fromDatabase: false,
          cachedAt: new Date(cached.cachedAt).toISOString(),
          expiresAt: new Date(cached.cachedAt + CACHE_DURATION_MS).toISOString(),
        },
        {
          headers: {
            'Cache-Control': 'public, max-age=3600',
            'X-Cache-Status': 'HIT',
          },
        },
      );
    }

    const apiKey = process.env.METAL_PRICE_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: 'Metal price API not configured' }, { status: 503 });
    }

    console.log(`Fetching fresh prices from API for ${currency}`);

    const response = await fetch(`https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=${currency}&unit=g`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('API request failed');
    }

    const priceData: CachedPrices = {
      goldPrice: Number(data.metals.gold.toFixed(2)),
      silverPrice: Number(data.metals.silver.toFixed(2)),
      platinumPrice: Number(data.metals.platinum.toFixed(2)),
      currency: data.currency,
      timestamp: data.timestamps.metal,
      cachedAt: now,
    };

    priceCache.set(cacheKey, priceData);

    return NextResponse.json(
      {
        goldPrice: priceData.goldPrice,
        silverPrice: priceData.silverPrice,
        platinumPrice: priceData.platinumPrice,
        currency: priceData.currency,
        timestamp: priceData.timestamp,
        date: priceData.timestamp,
        fromCache: false,
        fromDatabase: false,
        cachedAt: new Date(priceData.cachedAt).toISOString(),
        expiresAt: new Date(priceData.cachedAt + CACHE_DURATION_MS).toISOString(),
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=3600',
          'X-Cache-Status': 'MISS',
        },
      },
    );
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
