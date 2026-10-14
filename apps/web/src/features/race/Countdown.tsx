interface CountdownProps {
  /** Milisegundos que faltan para la salida (según el reloj del servidor). */
  remainingMs: number;
}

/**
 * Cuenta regresiva 3-2-1 sincronizada con el servidor. Se anuncia con
 * `aria-live` para lectores de pantalla.
 */
export function Countdown({ remainingMs }: CountdownProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const label = seconds > 0 ? String(seconds) : '¡Ya!';
  return (
    <div className="flex items-center gap-6 rounded-md bg-flag px-6 py-5 text-flag-ink">
      <p
        aria-live="assertive"
        aria-atomic="true"
        className="font-display w-24 text-center text-6xl tabular-nums leading-none"
      >
        {label}
      </p>
      <p className="max-w-xs text-sm">
        {seconds > 0
          ? 'Coloca los dedos en el teclado. El texto se desbloquea al llegar a cero.'
          : 'Escribe el texto lo más rápido que puedas.'}
      </p>
    </div>
  );
}
