import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

/**
 * primary: el amarillo de "atención" se reserva para la acción principal de cada pantalla.
 * secondary: contorno, para la alternativa. ghost: acciones de bajo peso (salir).
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-flag text-flag-ink hover:brightness-105 shadow-[inset_0_-3px_0_0_rgb(0_0_0/0.18)] disabled:bg-surface-2 disabled:text-muted disabled:shadow-none disabled:hover:brightness-100',
  secondary: 'bg-transparent text-ink border-2 border-ink hover:bg-surface-2 disabled:opacity-45',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2 disabled:opacity-45',
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
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-md px-5 font-bold transition-[filter,background-color,color,transform] active:translate-y-px disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
