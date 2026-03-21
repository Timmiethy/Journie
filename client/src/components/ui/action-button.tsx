import { forwardRef, type ReactNode } from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { tapMotionProps } from '../../lib/motion';
import { cn } from '../../lib/utils';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost' | 'glass' | 'dock';
type ActionButtonSize = 'md' | 'sm' | 'icon';

interface ActionButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  pending?: boolean;
  pendingLabel?: ReactNode;
}

const baseClassName =
  'tap-manipulation relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[18px] border font-sans uppercase tracking-[0.18em] transition-[background-color,border-color,color,opacity,transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-film-900/80 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-900 disabled:pointer-events-none disabled:opacity-50';

const variantClassNames: Record<ActionButtonVariant, string> = {
  primary:
    'border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.16)_0%,rgba(255,255,255,0.1)_100%)] text-film-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_36px_rgba(0,0,0,0.24)] backdrop-blur-xl hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(242,164,109,0.2)_0%,rgba(255,255,255,0.12)_100%)]',
  secondary:
    'border-white/8 bg-white/[0.04] text-film-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md hover:border-white/12 hover:bg-white/[0.07]',
  ghost:
    'border-transparent bg-transparent text-film-700 hover:border-abyss-700 hover:bg-abyss-800/70 hover:text-film-900',
  glass:
    'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.03)_100%)] text-film-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl hover:border-white/14 hover:bg-[linear-gradient(180deg,rgba(242,164,109,0.14)_0%,rgba(255,255,255,0.06)_100%)]',
  dock:
    'rounded-full border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.05)_100%)] text-film-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_24px_60px_rgba(0,0,0,0.34)] backdrop-blur-2xl hover:border-white/16 hover:bg-[linear-gradient(180deg,rgba(242,164,109,0.18)_0%,rgba(255,255,255,0.08)_100%)]',
};

const sizeClassNames: Record<ActionButtonSize, string> = {
  md: 'min-h-[52px] px-5 text-xs font-bold',
  sm: 'min-h-[42px] px-4 text-[11px] font-medium',
  icon: 'h-11 w-11 px-0 text-sm',
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      children,
      className,
      variant = 'primary',
      size = 'md',
      pending = false,
      pendingLabel,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <m.button
        ref={ref}
        type="button"
        disabled={disabled || pending}
        className={cn(
          baseClassName,
          variantClassNames[variant],
          sizeClassNames[size],
          className,
        )}
        {...tapMotionProps}
        {...props}
      >
        {pending ? pendingLabel ?? children : children}
      </m.button>
    );
  }
);

ActionButton.displayName = 'ActionButton';

export const TextButton = forwardRef<
  HTMLButtonElement,
  Omit<HTMLMotionProps<'button'>, 'children'> & { children: ReactNode }
>(({ children, className, ...props }, ref) => {
  return (
    <m.button
      ref={ref}
      type="button"
      className={cn(
        'tap-manipulation font-sans text-sm text-film-700 underline underline-offset-4 transition-colors duration-150 hover:text-film-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-film-900/80 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-900 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...tapMotionProps}
      {...props}
    >
      {children}
    </m.button>
  );
});

TextButton.displayName = 'TextButton';
