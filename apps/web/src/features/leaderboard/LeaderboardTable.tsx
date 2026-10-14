import type { LeaderboardEntry } from '../../api/types';
import { formatPercent } from '../../lib/stats';

const dateFormat = new Intl.DateTimeFormat('es', { dateStyle: 'medium' });

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Mejores velocidades registradas</caption>
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
            <th scope="col" className="hidden py-2 text-right sm:table-cell">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line tabular-nums">
          {entries.map((entry) => (
            <tr key={`${entry.rank}-${entry.nickname}`}>
              <td className="py-3 pr-4">
                <span
                  className={`inline-grid size-8 place-items-center rounded-md font-display ${
                    entry.rank === 1 ? 'bg-flag text-flag-ink' : ''
                  }`}
                >
                  {entry.rank}
                </span>
              </td>
              <td className="max-w-[8rem] truncate py-3 pr-4 font-semibold sm:max-w-none">
                {entry.nickname}
              </td>
              <td className="py-3 pr-4 text-right">
                <span className="font-display text-lg">{entry.wpm.toFixed(1)}</span>{' '}
                <span className="text-muted">ppm</span>
              </td>
              <td className="py-3 pr-4 text-right">{formatPercent(entry.accuracy)}</td>
              <td className="hidden py-3 text-right text-muted sm:table-cell">
                {dateFormat.format(entry.achievedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
