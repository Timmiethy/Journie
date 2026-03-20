import { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'pill';
}

export default function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  const base = 'font-sans transition-transform active:scale-[0.97] duration-100 disabled:opacity-50';
  const variants = {
    primary: 'w-full bg-accent-400 text-white text-[14px] font-medium py-3 rounded-[14px] active:bg-accent-300 disabled:bg-cream-300 disabled:text-ink-500',
    secondary: 'bg-cream-100 text-ink-700 text-[13px] py-[11px] px-[14px] rounded-button',
    pill: 'bg-transparent border border-accent-200 text-accent-400 text-[12px] px-[10px] py-1 rounded-[16px]',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
