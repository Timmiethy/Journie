import { motion } from 'framer-motion';
import { AuraShell } from './layout/AuraShell';
import { useStore } from '../lib/store';
import { withReducedMotion } from '../lib/motion';
import { usePrefersReducedMotion } from '../lib/use-prefers-reduced-motion';

interface LoadingScreenProps {
  eyebrow?: string;
  title?: string;
  description?: string;
}

export function LoadingScreen({
  eyebrow = 'preparing your space',
  title = 'Getting Journie ready.',
  description = 'We are lining up your next step so the transition feels instant once it lands.',
}: LoadingScreenProps) {
  const aura = useStore((state) => state.currentAura);
  const shouldReduceMotion = usePrefersReducedMotion();

  return (
    <AuraShell>
      <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-5 sm:py-10">
        <div className="w-full rounded-[26px] border border-abyss-700/80 bg-abyss-900/80 px-5 py-7 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:rounded-[30px] sm:px-6 sm:py-8">
          <div className="flex items-center gap-3">
            <motion.div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: aura }}
              animate={shouldReduceMotion ? { opacity: 0.85 } : { opacity: [0.55, 1, 0.55], scale: [0.94, 1.08, 0.94] }}
              transition={withReducedMotion(Boolean(shouldReduceMotion), {
                duration: 1.8,
                repeat: Infinity,
                ease: 'easeInOut',
              })}
            />
            <p className="font-sans text-[10px] uppercase tracking-[0.26em] text-film-500">
              {eyebrow}
            </p>
          </div>

          <h1 className="mt-4 font-sans text-[1.55rem] font-medium leading-tight text-film-900 sm:mt-5 sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-3 max-w-[28rem] font-sans text-sm leading-6 text-film-700">
            {description}
          </p>

          <div className="mt-8 overflow-hidden rounded-full border border-abyss-700/80 bg-abyss-800/90 p-1">
            <motion.div
              className="h-2 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${aura}66 0%, ${aura} 55%, rgba(255,255,255,0.92) 100%)`,
              }}
              animate={
                shouldReduceMotion
                  ? { opacity: 0.92, width: '55%' }
                  : { x: ['-38%', '92%'], width: ['28%', '40%', '30%'] }
              }
              transition={withReducedMotion(Boolean(shouldReduceMotion), {
                duration: 2.2,
                repeat: Infinity,
                ease: 'easeInOut',
              })}
            />
          </div>
        </div>
      </div>
    </AuraShell>
  );
}
