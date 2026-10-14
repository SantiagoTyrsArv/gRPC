import type { LeaderboardEntry } from '../../api/types';
import { DriverName } from '../../components/DriverName';
import { formatPercent } from '../../lib/stats';

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

/** Mejores velocidades: el primer puesto es el récord (morado, como la vuelta más rápida). */
export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">Mejores velocidades registradas</caption>
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
              <th scope="col" className="py-2 pr-4 text-right font-normal">
                Precisión
              </th>
              <th scope="col" className="hidden py-2 pr-4 text-right font-normal sm:table-cell">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {entries.map((entry) => {
              const isRecord = entry.rank === 1;
              return (
                <tr key={`${entry.rank}-${entry.nickname}`} className="relative">
                  <td className="relative py-3 pl-4">
                    {isRecord && (
                      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-best" />
                    )}
                    <span
                      className={`font-num mx-auto grid size-8 place-items-center rounded text-lg ${
                        isRecord ? 'bg-best text-best-ink' : ''
                      }`}
                    >
                      {entry.rank}
                    </span>
                  </td>
                  <td className="max-w-[10rem] truncate py-3 pl-2 sm:max-w-none">
                    <span className="inline-flex max-w-full items-baseline gap-2">
                      <DriverName nickname={entry.nickname} />
                      {isRecord && <span className="text-sm font-semibold text-best">Récord</span>}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-right">
                    <span className="font-num text-xl">{entry.wpm.toFixed(1)}</span>{' '}
                    <span className="text-sm text-muted">ppm</span>
                  </td>
                  <td className="py-3 pr-4 text-right">{formatPercent(entry.accuracy)}</td>
                  <td className="hidden py-3 pr-4 text-right text-muted sm:table-cell">
                    {dateFormat.format(entry.achievedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
