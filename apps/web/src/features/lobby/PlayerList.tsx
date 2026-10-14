import type { Player } from '../../api/types';
import { Lane } from '../../components/Lane';

interface PlayerListProps {
  players: Player[];
  selfId: string;
  maxPlayers: number;
}

function statusOf(player: Player): string {
  if (!player.isConnected) return 'Desconectado';
  if (player.isHost) return 'Anfitrión';
  return player.isReady ? 'Listo' : 'Preparándose';
}

/** Parrilla de salida: cada jugador en su carril, con su estado en vivo. */
export function PlayerList({ players, selfId, maxPlayers }: PlayerListProps) {
  const freeSlots = maxPlayers - players.length;
  return (
    <section aria-labelledby="parrilla">
      <h2 id="parrilla" className="text-lg font-semibold">
        Parrilla de salida{' '}
        <span className="font-normal text-muted">
          ({players.length} de {maxPlayers})
        </span>
      </h2>
      <ul className="mt-2 divide-y divide-line" aria-live="polite">
        {players.map((player, index) => (
          <Lane
            key={player.id}
            number={index + 1}
            nickname={player.nickname}
            percent={0}
            isSelf={player.id === selfId}
            dimmed={!player.isConnected}
            meta={statusOf(player)}
            trailing={
              player.isHost || player.isReady ? (
                <span className="font-semibold text-correct">✓ Listo</span>
              ) : (
                <span className="text-muted">Esperando</span>
              )
            }
          />
        ))}
      </ul>
      {freeSlots > 0 && (
        <p className="mt-3 text-sm text-muted">
          {freeSlots === 1 ? 'Queda 1 carril libre.' : `Quedan ${freeSlots} carriles libres.`}
        </p>
      )}
    </section>
  );
}
