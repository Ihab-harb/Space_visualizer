import { useEffect, useState } from 'react';
import { useTimeStore } from '../state/timeStore';

/** Live values change with the clock but need no more than about 4 Hz; a quiet clock updates at once, a busy one at most once per interval. */
export function useThrottledJd(intervalMs = 250): number {
  const [jd, setJd] = useState(() => useTimeStore.getState().jdTdb);
  useEffect(() => {
    let last = Number.NEGATIVE_INFINITY;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const publish = () => {
      timer = null;
      last = performance.now();
      setJd(useTimeStore.getState().jdTdb);
    };
    const unsubscribe = useTimeStore.subscribe((state, prev) => {
      if (state.jdTdb === prev.jdTdb) return;
      const wait = intervalMs - (performance.now() - last);
      if (wait <= 0) {
        if (timer !== null) clearTimeout(timer);
        publish();
      } else if (timer === null) timer = setTimeout(publish, wait);
    });
    setJd(useTimeStore.getState().jdTdb); // a change between render and subscription
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
    };
  }, [intervalMs]);
  return jd;
}
