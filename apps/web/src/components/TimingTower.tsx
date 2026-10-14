import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { DriverName } from './DriverName';

export interface TowerEntry {
  id: string;
  nickname: string;
  isSelf: boolean;
  /** Avance de 0 a 100: barra fina al pie de la fila. Se omite en la parrilla. */
  percent?: number;
  /** Ya cruzó la meta: se marca con la bandera a cuadros. */
  finished?: boolean;
  dimmed?: boolean;
  /** Dato principal (ppm). Se omite en la parrilla, que solo muestra el estado. */
  value?: ReactNode;
  /** Dato secundario a la derecha (diferencia con el líder, «Listo»…). */
  aside?: ReactNode;
}

interface TimingTowerProps {
  label: string;
  /** Encabezados de las columnas de datos. Sin `valueHeader` solo hay una (estado). */
  valueHeader?: string;
  asideHeader?: string;
  /** Ya ordenadas: la posición es el índice + 1. */
  entries: TowerEntry[];
  /** Si es `false`, el primero no se destaca como líder (p. ej. en la parrilla). */
  highlightLeader?: boolean;
  /** Franja superior, como en las transmisiones: título a la izquierda y reloj o contador a la derecha. */
  heading?: { title: ReactNode; detail?: ReactNode; live?: boolean };
  /** Puestos vacíos al final (parrilla de salida). */
  emptySlots?: number;
}

/**
 * Anima los cambios de posición (FLIP): cada fila se dibuja en su nuevo lugar y
 * se desliza desde el anterior. Respeta `prefers-reduced-motion` vía CSS global.
 */
function useReorderAnimation(ids: string[]) {
  const rows = useRef(new Map<string, HTMLLIElement>());
  const previous = useRef(new Map<string, number>());
  const order = ids.join('|');

  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const [id, el] of rows.current) {
      const top = el.offsetTop;
      next.set(id, top);
      const before = previous.current.get(id);
      if (before === undefined || before === top) continue;
      el.style.transition = 'none';
      el.style.transform = `translateY(${before - top}px)`;
      requestAnimationFrame(() => {
        el.style.transition = 'transform 450ms cubic-bezier(0.2, 0.8, 0.2, 1)';
        el.style.transform = '';
      });
    }
    previous.current = next;
  }, [order]);

  return (id: string) => (el: HTMLLIElement | null) => {
    if (el) rows.current.set(id, el);
    else rows.current.delete(id);
  };
}

/**
 * La torre de tiempos: posición, código de piloto, avance y dos columnas de
 * datos. Se usa en la portada (demo), la parrilla de salida y la carrera.
 */
export function TimingTower({
  label,
  valueHeader,
  asideHeader,
  entries,
  highlightLeader = true,
  heading,
  emptySlots = 0,
}: TimingTowerProps) {
  const register = useReorderAnimation(entries.map((e) => e.id));
  const hasValue = valueHeader !== undefined;
  const columns = hasValue
    ? 'grid-cols-[2.75rem_minmax(0,1fr)_4.5rem_4.75rem]'
    : 'grid-cols-[2.75rem_minmax(0,1fr)_7.5rem]';

  return (
    <section aria-label={label} className="overflow-hidden rounded-lg bg-surface shadow-sm">
      {heading && (
        <div className="flex items-center justify-between gap-3 bg-strip px-4 py-2.5 text-strip-ink">
          <p className="flex items-center gap-2 font-semibold">
            {heading.live && <span aria-hidden="true" className="size-2 rounded-full bg-error" />}
            {heading.title}
          </p>
          {heading.detail !== undefined && (
            <p className="font-num text-xl leading-none">{heading.detail}</p>
          )}
        </div>
      )}
      <div
        aria-hidden="true"
        className={`grid ${columns} items-center gap-x-2 border-b border-line px-3 py-2 text-xs text-muted`}
      >
        <span className="text-center">Pos.</span>
        <span>Piloto</span>
        {hasValue && <span className="text-right">{valueHeader}</span>}
        <span className="text-right">{asideHeader}</span>
      </div>
      <ol className="relative">
        {entries.map((entry, index) => {
          const position = index + 1;
          const isLeader = highlightLeader && position === 1;
          const percent = Math.max(0, Math.min(100, entry.percent ?? 0));
          return (
            <li
              key={entry.id}
              ref={register(entry.id)}
              aria-current={entry.isSelf ? 'true' : undefined}
              className={`relative grid ${columns} items-center gap-x-2 border-b border-line px-3 py-3 last:border-b-0 ${
                entry.isSelf ? 'bg-surface-2' : 'bg-surface'
              } ${entry.dimmed ? 'opacity-50' : ''}`}
            >
              {/* Franja de color: morado para el líder, amarillo para ti. */}
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1 ${
                  isLeader ? 'bg-best' : entry.isSelf ? 'bg-flag' : 'bg-transparent'
                }`}
              />
              <span
                className={`font-num grid h-8 place-items-center rounded text-lg leading-none ${
                  isLeader ? 'bg-best text-best-ink' : 'text-ink'
                }`}
              >
                <span className="sr-only">Posición </span>
                {position}
              </span>

              <span className="flex min-w-0 items-baseline gap-2">
                <DriverName nickname={entry.nickname} isSelf={entry.isSelf} />
                {entry.finished && (
                  <span
                    role="img"
                    aria-label="En la meta"
                    className="checkered inline-block size-3.5 shrink-0 self-center rounded-[2px]"
                  />
                )}
              </span>

              {hasValue && (
                <span className="font-num text-right text-2xl leading-none">{entry.value}</span>
              )}
              <span className="text-right text-sm text-muted tabular-nums">{entry.aside}</span>

              {entry.percent !== undefined && (
                <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-lane">
                  <span
                    className={`block h-full transition-[width] duration-300 ease-out ${
                      isLeader ? 'bg-best' : entry.finished ? 'bg-correct' : 'bg-ink/60'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </span>
              )}
            </li>
          );
        })}
        {Array.from({ length: emptySlots }, (_, i) => (
          <li
            key={`libre-${i}`}
            className={`grid ${columns} items-center gap-x-2 border-b border-dashed border-line px-3 py-3 text-muted last:border-b-0`}
          >
            <span className="font-num text-center text-lg">{entries.length + i + 1}</span>
            <span className="text-sm">Puesto libre</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
