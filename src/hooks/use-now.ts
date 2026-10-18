import { useEffect, useState } from 'react';

/** A `Date.now()` that re-renders the component every `ms`, for countdowns and "updated 5s ago" labels. */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
