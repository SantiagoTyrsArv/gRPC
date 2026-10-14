import type { PlayerResult } from '../../api/types';
import { formatPercent, formatSeconds } from '../../lib/stats';

interface ResultsPodiumProps {
  results: PlayerResult[];
  selfId: string;
}

/** Alturas del podio: el 1.º al centro y más alto. */
const PODIUM_ORDER = [2, 1, 3] as const;
const PODIUM_HEIGHT: Record<number, string> = { 1: 'h-36', 2: 'h-28', 3: 'h-20' };

/** Podio de los tres primeros y tabla completa de resultados. */
export function ResultsPodium({ results, selfId }: ResultsPodiumProps) {
  const byPosition = new Map(results.map((r) => [r.position, r]));

  return (
    <div className="flex flex-col gap-8">
      <ol className="flex items-end justify-center gap-2 sm:gap-4" aria-label="Podio">
        {PODIUM_ORDER.map((position) => {
          const result = byPosition.get(position);
          if (!result) return null;
          const isSelf = result.playerId === selfId;
          return (
            <li key={position} className="flex w-28 flex-col items-center gap-2 sm:w-36">
              <p className="w-full truncate text-center font-semibold">
                {result.nickname}
                {isSelf && <span className="font-normal text-muted"> (tú)</span>}
              </p>
              <p className="text-sm text-muted tabular-nums">{Math.round(result.wpm)} ppm</p>
              <div
                className={`flex w-full items-start justify-center rounded-t-md pt-3 ${PODIUM_HEIGHT[position]} ${
                  position === 1 ? 'bg-flag text-flag-ink' : 'bg-ink text-bg'
                }`}
              >
                <span className="font-display text-4xl" aria-label={`Posición ${position}`}>
                  {position}
                </span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-left">
          <caption className="sr-only">Resultados de la carrera</caption>
          <thead className="border-b-2 border-ink text-sm">
            <tr>
              <th scope="col" className="py-2 pr-4">
                Puesto
              </th>
              <th scope="col" className="py-2 pr-4">
                Jugador
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Velocidad
              </th>
              <th scope="col" className="py-2 pr-4 text-right">
                Precisión
              </th>
              <th scope="col" className="py-2 text-right">
                Tiempo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {results.map((r) => (
              <tr key={r.playerId} className={r.playerId === selfId ? 'bg-surface-2' : ''}>
                <td className="py-3 pr-4 font-display">{r.position}</td>
                <td className="py-3 pr-4 font-semibold">{r.nickname}</td>
                <td className="py-3 pr-4 text-right">{Math.round(r.wpm)} ppm</td>
                <td className="py-3 pr-4 text-right">{formatPercent(r.accuracy)}</td>
                <td className="py-3 text-right">
                  {r.finished ? formatSeconds(r.elapsedMs) : 'No terminó'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
