import { useEffect, useRef, useState, RefObject } from 'react';

/**
 * Pauses canvas requestAnimationFrame loops when the element
 * is scrolled out of view, saving CPU/GPU on mobile.
 */
export function useCanvasVisibility(ref: RefObject<HTMLElement | null>): boolean {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return isVisible;
}
