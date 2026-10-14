import type { Player, Progress } from '../../api/types';
import { Lane } from '../../components/Lane';
import { calculateWpm } from '../../lib/stats';

interface ProgressTrackProps {
  players: Player[];
  progress: Record<string, Progress>;
  selfId: string;
  /** Tiempo de carrera transcurrido (reloj del servidor), para el WPM en vivo. */
  elapsedMs: number;
  /** Avance propio calculado localmente (más fluido que esperar al servidor). */
  selfOverride?: { percent: number; wpm: number; finished: boolean };
}

/** Pista con el avance en vivo de todos los jugadores. */
export function ProgressTrack({
  players,
  progress,
  selfId,
  elapsedMs,
  selfOverride,
}: ProgressTrackProps) {
  return (
    <section aria-label="Pista de carrera">
      <ul className="divide-y divide-line">
        {players.map((player, index) => {
          const isSelf = player.id === selfId;
          const server = progress[player.id];
          const p = isSelf && selfOverride ? selfOverride : server;
          const percent = p?.percent ?? 0;
          // El WPM de los rivales se recalcula con el tiempo actual (misma fórmula
          // que el servidor), para que baje si dejan de escribir.
          const wpm =
            isSelf || !server || server.finished
              ? (p?.wpm ?? 0)
              : calculateWpm(server.typedCorrect, elapsedMs);
          return (
            <Lane
              key={player.id}
              number={index + 1}
              nickname={player.nickname}
              percent={percent}
              isSelf={isSelf}
              dimmed={!player.isConnected}
              meta={
                p?.finished
                  ? 'En la meta'
                  : player.isConnected
                    ? `${Math.floor(percent)}%`
                    : 'Desconectado'
              }
              trailing={
                <span>
                  <span className="font-display text-lg">{Math.round(wpm)}</span>{' '}
                  <span className="text-muted">ppm</span>
                </span>
              }
            />
          );
        })}
      </ul>
    </section>
  );
}
