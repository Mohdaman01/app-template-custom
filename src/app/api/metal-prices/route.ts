// src/app/api/metal-prices/route.ts
import { NextRequest, NextResponse } from 'next/server';

// In-memory cache for metal prices
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const currency = searchParams.get('currency') || 'USD';
  const cacheKey = `prices_${currency}`;

  try {
    // Check if we have cached data for this currency
    const cached = priceCache.get(cacheKey);
    const now = Date.now();

    if (cached && now - cached.cachedAt < CACHE_DURATION_MS) {
      // Return cached data with a header indicating it's from cache
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

    // Using metals.dev API
    // The API returns prices per gram for gold, silver, platinum
    const response = await fetch(
      `https://api.metals.dev/v1/latest?api_key=${apiKey}&currency=${currency}&unit=g`,
      { cache: 'no-store' }, // Don't use Next.js cache, we manage our own
    );

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error('API request failed');
    }

    // metals.dev returns prices per gram directly
    // Round to 2 decimal places for consistency
    const priceData: CachedPrices = {
      goldPrice: Number(data.metals.gold.toFixed(2)),
      silverPrice: Number(data.metals.silver.toFixed(2)),
      platinumPrice: Number(data.metals.platinum.toFixed(2)),
      currency: data.currency,
      timestamp: data.timestamps.metal,
      cachedAt: now,
    };

    // Store in cache
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
