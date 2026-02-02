import { useState, useEffect } from 'react';
import type { NormalizedData } from '../types';

interface UseNormalizedDataResult {
  data: NormalizedData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to load the normalized artist data
 * Data is served as a static JSON file from /data/normalized/
 */
export function useNormalizedData(): UseNormalizedDataResult {
  const [data, setData] = useState<NormalizedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await fetch('/data/normalized/jeff-porcaro.json');
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
        setData(null);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  return { data, loading, error };
}
