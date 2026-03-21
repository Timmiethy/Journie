import { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export function usePrefersReducedMotion() {
  const motionPreference = useReducedMotion();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    getInitialReducedMotion(Boolean(motionPreference)),
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      setPrefersReducedMotion(Boolean(motionPreference));
      return undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => {
      setPrefersReducedMotion(Boolean(motionPreference) || mediaQuery.matches);
    };

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => {
      mediaQuery.removeEventListener('change', updatePreference);
    };
  }, [motionPreference]);

  return prefersReducedMotion;
}

function getInitialReducedMotion(motionPreference: boolean) {
  if (typeof window === 'undefined') {
    return motionPreference;
  }

  return motionPreference || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
