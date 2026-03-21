import { useStore } from '../../lib/store';

interface AuraShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AuraShell({ children, className = '' }: AuraShellProps) {
  const aura = useStore((s) => s.currentAura);

  return (
    <div className={`relative min-h-screen overflow-x-hidden bg-abyss-900 ${className}`}>
      {/* The Aura — fixed position radial gradient, color = currentAura */}
      <div
        className="pointer-events-none fixed inset-0 animate-aura-shift"
        style={{
          background: `radial-gradient(ellipse 60% 50% at 70% 20%, ${aura}22 0%, transparent 70%)`,
        }}
      />

      {/* A second, smaller counter-aura at bottom-left for depth */}
      <div
        className="pointer-events-none fixed inset-0 animate-aura-shift"
        style={{
          background: `radial-gradient(ellipse 40% 40% at 20% 80%, ${aura}15 0%, transparent 60%)`,
          animationDelay: '2s',
        }}
      />

      {/* Page content */}
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[480px] flex-col border-x border-abyss-700/70 bg-abyss-900/72 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_32px_120px_rgba(0,0,0,0.45)] backdrop-blur-[2px]">
        {children}
      </div>
    </div>
  );
}
