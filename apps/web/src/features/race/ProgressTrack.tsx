import type { Player, PlayerResult, Progress } from '../../api/types';
import { TimingTower, type TowerEntry } from '../../components/TimingTower';
import { calculateWpm } from '../../lib/stats';

interface ProgressTrackProps {
  players: Player[];
  progress: Record<string, Progress>;
  /** Llegadas confirmadas por el servidor: fijan el orden de los que ya terminaron. */
  results: PlayerResult[];
  selfId: string;
  /** Tiempo de carrera transcurrido (reloj del servidor), para el WPM en vivo. */
  elapsedMs: number;
  /** Avance propio calculado localmente (más fluido que esperar al servidor). */
  selfOverride?: { typedCorrect: number; percent: number; wpm: number; finished: boolean };
  heading: { title: string; detail: string; live: boolean };
}

/** Torre de tiempos de la carrera: ordenada por llegada y luego por avance. */
export function ProgressTrack({
  players,
  progress,
  results,
  selfId,
  elapsedMs,
  selfOverride,
  heading,
}: ProgressTrackProps) {
  const finishOrder = new Map(results.map((r) => [r.playerId, r.position]));

  const rows = players.map((player, index) => {
    const isSelf = player.id === selfId;
    const server = progress[player.id];
    const p = isSelf && selfOverride ? selfOverride : server;
    // El WPM de los rivales se recalcula con el tiempo actual (misma fórmula que el
    // servidor), para que baje si dejan de escribir.
    const wpm =
      isSelf || !server || server.finished
        ? (p?.wpm ?? 0)
        : calculateWpm(server.typedCorrect, elapsedMs);
    return {
      player,
      index,
      isSelf,
      typed: p?.typedCorrect ?? 0,
      percent: p?.percent ?? 0,
      finished: p?.finished ?? false,
      wpm,
      arrival: finishOrder.get(player.id),
    };
  });

  rows.sort((a, b) => {
    if (a.arrival !== undefined || b.arrival !== undefined) {
      return (a.arrival ?? Infinity) - (b.arrival ?? Infinity);
    }
    return b.typed - a.typed || a.index - b.index;
  });

  const leaderTyped = rows[0]?.typed ?? 0;
  const entries: TowerEntry[] = rows.map((row, position) => ({
    id: row.player.id,
    nickname: row.player.nickname,
    isSelf: row.isSelf,
    percent: row.percent,
    finished: row.finished,
    dimmed: !row.player.isConnected,
    value: (
      <>
        {Math.round(row.wpm)}
        <span className="sr-only"> palabras por minuto</span>
      </>
    ),
    aside: !row.player.isConnected ? (
      'Fuera'
    ) : row.finished ? (
      'Meta'
    ) : position === 0 ? (
      leaderTyped > 0 ? (
        'Líder'
      ) : (
        '—'
      )
    ) : (
      <>
        +{leaderTyped - row.typed}
        <span className="sr-only"> letras detrás del líder</span>
      </>
    ),
  }));

  return (
    <TimingTower
      label="Torre de tiempos"
      heading={heading}
      // Antes de que alguien escriba no hay líder que destacar.
      highlightLeader={leaderTyped > 0}
      valueHeader="ppm"
      asideHeader="Dif."
      entries={entries}
    />
  );
}
