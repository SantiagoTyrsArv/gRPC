import type { PlayerResult } from '../../api/types';
import { DriverName } from '../../components/DriverName';
import { formatPercent, formatSeconds } from '../../lib/stats';

interface ClassificationProps {
  results: PlayerResult[];
  selfId: string;
}

/** Clasificación final, como la hoja oficial de una carrera: el ganador marca la referencia. */
export function Classification({ results, selfId }: ClassificationProps) {
  const winner = results.find((r) => r.position === 1);

  const gapTo = (r: PlayerResult): string => {
    if (!r.finished) return 'No terminó';
    if (r.position === 1 || !winner?.finished) return formatSeconds(r.elapsedMs);
    return `+${formatSeconds(r.elapsedMs - winner.elapsedMs)}`;
  };

  return (
    <section aria-labelledby="clasificacion" className="overflow-hidden rounded-lg bg-surface">
      <h2 id="clasificacion" className="bg-strip px-4 py-2.5 font-semibold text-strip-ink">
        Clasificación final
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Resultados de la carrera</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="w-14 py-2 pl-4 text-center font-normal">
                Pos.
              </th>
              <th scope="col" className="py-2 pl-2 font-normal">
                Piloto
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                Velocidad
              </th>
              <th scope="col" className="hidden py-2 pr-4 text-right font-normal sm:table-cell">
                Precisión
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                Tiempo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {results.map((r) => {
              const isSelf = r.playerId === selfId;
              const isWinner = r.position === 1;
              return (
                <tr key={r.playerId}>
                  <td className="relative py-3 pl-4">
                    {/* Franja amarilla: tu fila (como en la torre de tiempos). */}
                    {isSelf && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-flag" />
                    )}
                    <span
                      className={`font-num mx-auto grid size-8 place-items-center rounded text-lg ${
                        isWinner ? 'bg-best text-best-ink' : ''
                      }`}
                    >
                      {r.position}
                    </span>
                  </td>
                  <td className="py-3 pl-2">
                    <DriverName nickname={r.nickname} isSelf={isSelf} />
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="font-num text-xl">{Math.round(r.wpm)}</span>{' '}
                    <span className="text-sm text-muted">ppm</span>
                  </td>
                  <td className="hidden py-3 pr-4 text-right sm:table-cell">
                    {formatPercent(r.accuracy)}
                  </td>
                  <td className={`py-3 pr-4 text-right ${r.finished ? '' : 'text-muted'}`}>
                    {gapTo(r)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
