'use client';

import { useRef, useCallback } from 'react';

export function useSyncScroll() {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isScrolling = useRef(false);

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isScrolling.current) return;

    const sourceRef = source === 'left' ? leftRef : rightRef;
    const targetRef = source === 'left' ? rightRef : leftRef;

    if (!sourceRef.current || !targetRef.current) return;

    // Calculate scroll percentage
    const sourceElement = sourceRef.current;
    const targetElement = targetRef.current;

    const scrollPercentage =
      sourceElement.scrollTop /
      (sourceElement.scrollHeight - sourceElement.clientHeight);

    // Set the target scroll position
    isScrolling.current = true;
    targetElement.scrollTop =
      scrollPercentage * (targetElement.scrollHeight - targetElement.clientHeight);

    // Reset flag after a short delay
    setTimeout(() => {
      isScrolling.current = false;
    }, 50);
  }, []);

  const scrollToChange = useCallback((changeId: string) => {
    const element = document.querySelector(`[data-change-id="${changeId}"]`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return { leftRef, rightRef, handleScroll, scrollToChange };
}
