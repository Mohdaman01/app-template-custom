// src/app/client-hooks/metal-prices.ts
'use client';
import { useState, useCallback } from 'react';

interface MetalPrices {
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
  currency: string;
  timestamp: string;
  date: string;
  fromCache?: boolean;
  cachedAt?: string;
  expiresAt?: string;
}

export const useMetalPrices = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const fetchPrices = useCallback(async (currency: string = 'USD'): Promise<MetalPrices | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/metal-prices?currency=${currency}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch prices');
      }

      const data = await response.json();
      setLastFetch(new Date());
      setIsFromCache(data.fromCache || false);

      // Log cache status for debugging
      if (data.fromCache) {
        console.log(`Prices loaded from cache. Cached at: ${data.cachedAt}, Expires at: ${data.expiresAt}`);
      } else {
        console.log(`Fresh prices fetched from API. Expires at: ${data.expiresAt}`);
      }

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching metal prices:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchPrices, loading, error, lastFetch, isFromCache };
};
