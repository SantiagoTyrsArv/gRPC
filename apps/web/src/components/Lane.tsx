import type { ReactNode } from 'react';

interface LaneProps {
  /** Número de carril (1-5), pintado en el auto. */
  number: number;
  nickname: string;
  /** Avance de 0 a 100. */
  percent: number;
  isSelf: boolean;
  dimmed?: boolean;
  /** Información a la izquierda bajo el apodo (anfitrión, listo, desconectado…). */
  meta?: ReactNode;
  /** Información a la derecha (WPM, posición…). */
  trailing?: ReactNode;
}

/**
 * Un carril de la pista: el auto con su número avanza hacia la meta a cuadros.
 * Se usa en el lobby (todos en la salida), en la carrera y en los resultados.
 */
export function Lane({ number, nickname, percent, isSelf, dimmed, meta, trailing }: LaneProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 py-3 sm:grid-cols-[11rem_minmax(0,1fr)_5.5rem] ${dimmed ? 'opacity-50' : ''}`}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {nickname}
          {isSelf && <span className="font-normal text-muted"> (tú)</span>}
        </p>
        {meta && <div className="text-sm text-muted">{meta}</div>}
      </div>

      <div className="text-right text-sm tabular-nums sm:order-last">{trailing}</div>

      <div
        className="relative col-span-2 h-11 overflow-hidden rounded-md bg-lane sm:col-span-1"
        role="progressbar"
        aria-label={`Avance de ${nickname}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped)}
      >
        {/* Línea discontinua del carril */}
        <div
          aria-hidden="true"
          className="absolute inset-x-3 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-line"
        />
        {/* Meta a cuadros */}
        <div aria-hidden="true" className="checkered absolute inset-y-0 right-0 w-3" />
        {/* Auto con el número de carril */}
        <div
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 transition-[left] duration-300 ease-out"
          style={{ left: `calc((100% - 3.5rem) * ${clamped / 100} + 0.25rem)` }}
        >
          <div
            className={`grid h-7 w-12 place-items-center rounded-[0.6rem_0.9rem_0.9rem_0.6rem] font-display text-sm leading-none ${
              isSelf ? 'bg-flag text-flag-ink shadow-[0_0_0_2px_var(--c-ink)]' : 'bg-ink text-bg'
            }`}
          >
            {number}
          </div>
        </div>
      </div>
    </li>
  );
}
