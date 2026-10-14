interface CountdownProps {
  /** Milisegundos que faltan para la salida (según el reloj del servidor). */
  remainingMs: number;
}

const LIGHTS = 3;

/**
 * Semáforo de salida sincronizado con el servidor: se enciende una luz roja por
 * segundo y todas se apagan al largar. Se anuncia con `aria-live`.
 */
export function Countdown({ remainingMs }: CountdownProps) {
  const seconds = Math.ceil(remainingMs / 1000);
  const label = seconds > 0 ? String(seconds) : '¡Ya!';
  // 3 s → 1 luz, 2 s → 2 luces, 1 s → 3 luces, 0 → apagadas (salida).
  const lit = seconds > 0 ? Math.min(LIGHTS, LIGHTS + 1 - seconds) : 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg bg-strip px-5 py-4 text-strip-ink">
      <div aria-hidden="true" className="flex gap-2.5">
        {Array.from({ length: LIGHTS }, (_, i) => (
          <span
            key={i}
            className={`size-9 rounded-full border-2 border-strip-ink/20 transition-colors duration-150 ${
              i < lit ? 'bg-error shadow-[0_0_18px_var(--c-error)]' : 'bg-strip-ink/10'
            }`}
          />
        ))}
      </div>
      <p
        aria-live="assertive"
        aria-atomic="true"
        className="font-display w-16 text-5xl tabular-nums leading-none"
      >
        {label}
      </p>
      <p className="max-w-xs text-sm text-strip-ink/75">
        {seconds > 0
          ? 'Coloca los dedos en el teclado. El texto se desbloquea cuando se apagan las luces.'
          : 'Escribe el texto lo más rápido que puedas.'}
      </p>
    </div>
  );
}
