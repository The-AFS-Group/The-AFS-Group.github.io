import { useState, useEffect } from 'react';
import { parseCSV } from '../utils/helpers';
import { getCachedData, setCachedData, isCacheStale } from '../services/dataService';

export function useCallData(url: string) {
  const cacheKey = 'call_insights_data';
  const cachedData = getCachedData<any[]>(cacheKey);
  const [data, setData] = useState<any[] | null>(cachedData || null);
  const [error, setError] = useState<any>(null);
  const [isUpdating, setIsUpdating] = useState(!cachedData || isCacheStale(cacheKey));

  useEffect(() => {
    let isMounted = true;
    async function run(force = false) {
      try {
        if (!force && !isCacheStale(cacheKey)) {
           if (isMounted) setIsUpdating(false);
           return;
        }
        setIsUpdating(true);
        const res = await fetch(url, { cache: "no-store" });
        const txt = await res.text();
        const parsed = parseCSV(txt);
        if (isMounted) {
            setData(parsed);
            setCachedData(cacheKey, parsed);
        }
      } catch (e) {
        if (isMounted) setError(e);
      } finally {
        if (isMounted) setIsUpdating(false);
      }
    }
    run();
    const id = setInterval(() => run(true), 15 * 60 * 1000); // refresh every 15 mins
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [url]);

  return { data, error, isUpdating };
}