import { useEffect, useState } from 'react';

/** Hora actual (ms) que se actualiza cada `intervalMs` mientras `active`. */
export function useNow(intervalMs = 100, active = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => {
      setNow(Date.now());
    }, intervalMs);
    return () => {
      clearInterval(id);
    };
  }, [intervalMs, active]);
  return now;
}
