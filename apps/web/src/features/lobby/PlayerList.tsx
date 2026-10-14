import type { Player } from '../../api/types';
import { TimingTower } from '../../components/TimingTower';

interface PlayerListProps {
  players: Player[];
  selfId: string;
  maxPlayers: number;
}

function Status({ player }: { player: Player }) {
  if (!player.isConnected) return <span>Desconectado</span>;
  if (player.isHost) return <span className="text-ink">Anfitrión</span>;
  return player.isReady ? (
    <span className="font-semibold text-correct">Listo</span>
  ) : (
    <span>Preparándose</span>
  );
}

/** Parrilla de salida: cada jugador en su puesto, con su estado en vivo. */
export function PlayerList({ players, selfId, maxPlayers }: PlayerListProps) {
  const freeSlots = maxPlayers - players.length;
  return (
    <div aria-live="polite">
      <TimingTower
        label="Parrilla de salida"
        heading={{ title: 'Parrilla de salida', detail: `${players.length}/${maxPlayers}` }}
        asideHeader="Estado"
        highlightLeader={false}
        emptySlots={Math.max(0, freeSlots)}
        entries={players.map((player) => ({
          id: player.id,
          nickname: player.nickname,
          isSelf: player.id === selfId,
          dimmed: !player.isConnected,
          aside: <Status player={player} />,
        }))}
      />
    </div>
  );
}
