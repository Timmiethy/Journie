import { forwardRef, type ReactNode } from 'react';
import { m, type HTMLMotionProps } from 'framer-motion';
import { tapMotionProps } from '../../lib/motion';
import { cn } from '../../lib/utils';

type ActionButtonVariant = 'primary' | 'secondary' | 'ghost';
type ActionButtonSize = 'md' | 'sm' | 'icon';

interface ActionButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  children: ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  pending?: boolean;
  pendingLabel?: ReactNode;
}

const baseClassName =
  'tap-manipulation inline-flex items-center justify-center gap-2 rounded-[18px] border font-sans uppercase tracking-[0.18em] transition-[background-color,border-color,color,opacity,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-film-900/80 focus-visible:ring-offset-2 focus-visible:ring-offset-abyss-900 disabled:pointer-events-none disabled:opacity-50';

const variantClassNames: Record<ActionButtonVariant, string> = {
  primary:
    'border-film-900 bg-film-900 text-abyss-900 hover:border-film-700 hover:bg-film-700',
  secondary:
    'border-abyss-600 bg-abyss-900/80 text-film-900 hover:border-film-700 hover:bg-abyss-800',
  ghost:
    'border-transparent bg-transparent text-film-700 hover:border-abyss-700 hover:bg-abyss-800/70 hover:text-film-900',
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
