import type { ReactNode } from 'react';

interface AlertProps {
  tone?: 'error' | 'info';
  children: ReactNode;
}

/** Mensaje de estado. Los errores se anuncian a lectores de pantalla (`role="alert"`). */
export function Alert({ tone = 'error', children }: AlertProps) {
  const styles =
    tone === 'error' ? 'border-error bg-error-bg text-ink' : 'border-line bg-surface-2 text-ink';
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-md border-l-4 px-4 py-3 text-sm ${styles}`}
    >
      {children}
    </div>
  );
}
