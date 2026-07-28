import { useState, useEffect } from 'react';
import Papa from 'papaparse';

export function useCallData(url: string) {
  const [data, setData] = useState<any[] | null>(null);
  const [error, setError] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    function run() {
      setLoading(true);
      const cacheBusterUrl = `${url}&_t=${Date.now()}`;
      Papa.parse(cacheBusterUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        worker: true,
        complete: (results) => {
          if (isMounted) {
            setData(results.data);
            setLoading(false);
          }
        },
        error: (err) => {
          if (isMounted) {
            setError(err);
            setLoading(false);
          }
        }
      });
    }
    run();
    const id = setInterval(run, 60_000); // refresh every 60s
    return () => {
      isMounted = false;
      clearInterval(id);
    };
  }, [url]);

  return { data, error, loading };
}