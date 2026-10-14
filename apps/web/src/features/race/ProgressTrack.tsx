import type { Player, Progress } from '../../api/types';
import { Lane } from '../../components/Lane';

interface ProgressTrackProps {
  players: Player[];
  progress: Record<string, Progress>;
  selfId: string;
  /** Avance propio calculado localmente (más fluido que esperar al servidor). */
  selfOverride?: { percent: number; wpm: number; finished: boolean };
}

/** Pista con el avance en vivo de todos los jugadores. */
export function ProgressTrack({ players, progress, selfId, selfOverride }: ProgressTrackProps) {
  return (
    <section aria-label="Pista de carrera">
      <ul className="divide-y divide-line">
        {players.map((player, index) => {
          const isSelf = player.id === selfId;
          const p = isSelf && selfOverride ? selfOverride : progress[player.id];
          const percent = p?.percent ?? 0;
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
                    ? `${Math.round(percent)}%`
                    : 'Desconectado'
              }
              trailing={
                <span>
                  <span className="font-display text-lg">{Math.round(p?.wpm ?? 0)}</span>{' '}
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
