import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-flag text-flag-ink hover:brightness-95 shadow-[0_2px_0_0_var(--c-flag-ink)]',
  secondary: 'bg-surface text-ink border-2 border-ink hover:bg-surface-2',
  ghost: 'text-ink hover:bg-surface-2',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  pending?: boolean;
}

export function Button({
  variant = 'primary',
  pending = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled ?? pending}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-5 font-semibold transition active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
