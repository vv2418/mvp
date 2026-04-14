import { useState, useEffect } from 'react';

type CountUpValueProps = {
  value: number;
  durationMs?: number;
  className?: string;
};

/**
 * Eased count-up (same easing as Discover) for metrics on load / when value changes.
 */
export function CountUpValue({ value, durationMs = 900, className = '' }: CountUpValueProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const end = Math.max(0, Math.floor(value));
    const startAt = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startAt) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(end * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return <span className={className}>{display.toLocaleString()}</span>;
}
