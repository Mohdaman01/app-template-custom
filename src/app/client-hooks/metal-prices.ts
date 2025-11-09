// src/app/client-hooks/metal-prices.ts - UPDATED VERSION
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
  fromDatabase?: boolean;
  cachedAt?: string;
  expiresAt?: string;
  fetchedAt?: string;
  ageHours?: number;
  nextUpdateIn?: string;
}

export const useMetalPrices = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [isFromDatabase, setIsFromDatabase] = useState(false);

  /**
   * Fetch metal prices
   * @param currency - Currency code (USD, EUR, etc.)
   * @param useDatabase - If true, fetches from database (updated every 6 hours). If false, uses API with 1-hour cache.
   */
  const fetchPrices = useCallback(
    async (currency: string = 'USD', useDatabase: boolean = false): Promise<MetalPrices | null> => {
      setLoading(true);
      setError(null);

      try {
        const url = `/api/metal-prices?currency=${currency}${useDatabase ? '&useDatabase=true' : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch prices');
        }

        const data = await response.json();
        setLastFetch(new Date());
        setIsFromCache(data.fromCache || false);
        setIsFromDatabase(data.fromDatabase || false);

        // Log cache/database status for debugging
        if (data.fromDatabase) {
          console.log(`Prices loaded from database (${data.ageHours}h old). Next update in: ${data.nextUpdateIn}`);
        } else if (data.fromCache) {
          console.log(`Prices loaded from in-memory cache. Cached at: ${data.cachedAt}, Expires at: ${data.expiresAt}`);
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
    },
    [],
  );

  return { fetchPrices, loading, error, lastFetch, isFromCache, isFromDatabase };
};
