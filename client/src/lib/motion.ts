import type { MotionProps, Transition, Variants } from 'framer-motion';

export const spring: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export const modalSpring: Transition = {
  ...spring,
  bounce: 0,
};

export const tapScale = {
  scale: 0.97,
} as const;

export const tapMotionProps: Pick<MotionProps, 'whileTap' | 'transition'> = {
  whileTap: tapScale,
  transition: spring,
};

export const fadeTransition = {
  duration: 0.18,
};

export const CAPTURE_MORPH_LAYOUT_ID = 'capture-morph';

export const reducedMotionTransition: Transition = {
  duration: 0.12,
  ease: 'easeOut',
};

export function withReducedMotion(shouldReduce: boolean, transition = spring): Transition {
  return shouldReduce ? reducedMotionTransition : transition;
}

export function getDirectionalVariants(
  shouldReduce: boolean,
  distance = 18,
): Variants {
  if (shouldReduce) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    };
  }

  return {
    hidden: (direction: 'forward' | 'back') => ({
      opacity: 0,
      x: direction === 'forward' ? distance : -distance,
    }),
    visible: {
      opacity: 1,
      x: 0,
    },
    exit: (direction: 'forward' | 'back') => ({
      opacity: 0,
      x: direction === 'forward' ? -distance : distance,
    }),
  };
}
