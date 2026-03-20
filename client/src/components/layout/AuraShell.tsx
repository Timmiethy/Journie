import { useStore } from '../../lib/store';

interface AuraShellProps {
  children: React.ReactNode;
  className?: string;
}

export function AuraShell({ children, className = '' }: AuraShellProps) {
  const aura = useStore((s) => s.currentAura);

  return (
    <div className={`relative min-h-screen overflow-hidden ${className}`}>
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
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
}
