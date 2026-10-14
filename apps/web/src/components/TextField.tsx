import { useId, type InputHTMLAttributes } from 'react';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  /** Oculta la etiqueta visualmente (sigue disponible para lectores de pantalla). */
  hideLabel?: boolean;
  wrapperClassName?: string;
}

export function TextField({
  label,
  hint,
  hideLabel = false,
  className = '',
  wrapperClassName = '',
  ...props
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${wrapperClassName}`}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'text-sm font-semibold'}>
        {label}
      </label>
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        {...props}
        className={`min-h-12 rounded-md border-2 border-line bg-surface px-3 text-base text-ink placeholder:text-muted/70 hover:border-muted focus:border-ink focus:outline-none ${className}`}
      />
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
