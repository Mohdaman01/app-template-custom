// src/app/client-hooks/metal-prices.ts - UPDATED
'use client';
import { useState, useCallback } from 'react';

interface MetalPrices {
  goldPrice: number;
  silverPrice: number;
  platinumPrice: number;
  currency: string;
  timestamp: string;
  date: string;
  fromDatabase?: boolean;
  fetchedAt?: string;
  ageHours?: number;
  nextUpdateIn?: string;
}

export const useMetalPrices = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [isFromDatabase, setIsFromDatabase] = useState(false);

  /**
   * Fetch metal prices from the database.
   * Prices are updated periodically by a cron job.
   * @param currency - Currency code (USD, EUR, etc.)
   */
  const fetchPrices = useCallback(async (currency: string = 'USD'): Promise<MetalPrices | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = `/api/metal-prices?currency=${currency}`;
      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch prices');
      }

      const data = await response.json();
      setLastFetch(new Date());
      setIsFromDatabase(data.fromDatabase || false);

      if (data.fromDatabase) {
        console.log(`Prices loaded from database (${data.ageHours}h old). Next update in: ${data.nextUpdateIn}`);
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

  return { fetchPrices, loading, error, lastFetch, isFromDatabase };
};
