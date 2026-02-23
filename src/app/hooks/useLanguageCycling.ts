import { useState, useEffect } from 'react';

const ANIMATION_INTERVAL_MS = 3000;
const ANIMATION_DURATION_S = 0.8;

interface AnimationConfig {
  interval: number;
  duration: number;
}

export const LANGUAGE_BADGE_ANIMATION: AnimationConfig = {
  interval: ANIMATION_INTERVAL_MS,
  duration: ANIMATION_DURATION_S,
};

/**
 * Custom hook that cycles through visible language indices
 * Returns an array of 3 indices that rotate over time
 */
export function useLanguageCycling(totalLanguages: number) {
  const [visibleLanguages, setVisibleLanguages] = useState<number[]>([0, 1, 2]);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleLanguages((prev) => {
        const next = [...prev];
        const removed = next.shift()!;
        next.push((removed + totalLanguages) % totalLanguages);
        return next;
      });
    }, LANGUAGE_BADGE_ANIMATION.interval);

    return () => clearInterval(interval);
  }, [totalLanguages]);

  return visibleLanguages;
}
