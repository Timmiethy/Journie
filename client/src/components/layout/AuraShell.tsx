import { useStore } from '../../lib/store';

interface AuraShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AuraShell({ children, className = '' }: AuraShellProps) {
  const aura = useStore((s) => s.currentAura);

  return (
    <div className={`relative min-h-screen overflow-x-hidden bg-abyss-950 ${className}`}>
      <div
        className="pointer-events-none fixed inset-0 animate-aura-shift"
        style={{
          background: `radial-gradient(ellipse 58% 48% at 72% 16%, ${aura}2f 0%, transparent 72%)`,
        }}
      />

      <div
        className="pointer-events-none fixed inset-0 animate-aura-shift"
        style={{
          background: `radial-gradient(ellipse 42% 40% at 18% 78%, rgba(242,164,109,0.14) 0%, transparent 64%)`,
          animationDelay: '1.6s',
        }}
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(5,5,5,0) 18%, rgba(5,5,5,0.34) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.015)_18%,rgba(5,5,5,0.16)_100%)] backdrop-blur-[3px]">
        {children}
      </div>
    </div>
  );
}
