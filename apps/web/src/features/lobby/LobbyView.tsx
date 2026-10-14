import type { Room } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { useAsyncAction } from '../../hooks/use-async-action';
import { setReady, startRace } from '../room/room-actions';
import { PlayerList } from './PlayerList';
import { RoomCode } from './RoomCode';

interface LobbyViewProps {
  room: Room;
  selfId: string;
}

export function LobbyView({ room, selfId }: LobbyViewProps) {
  const self = room.players.find((p) => p.id === selfId);
  const ready = useAsyncAction(setReady);
  const start = useAsyncAction(startRace);

  const waitingFor = room.players.filter((p) => !p.isHost && !p.isReady);
  const canStart = waitingFor.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Sala de espera</h1>
        <p className="mt-2 max-w-prose text-muted">
          Comparte el código para que entren hasta {room.maxPlayers} jugadores. El anfitrión da la
          salida cuando todos estén listos.
        </p>
      </div>

      <RoomCode code={room.code} />
      <PlayerList players={room.players} selfId={selfId} maxPlayers={room.maxPlayers} />

      <div className="flex flex-col gap-3">
        {ready.error && <Alert>{ready.error}</Alert>}
        {start.error && <Alert>{start.error}</Alert>}
        {self?.isHost ? (
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={() => void start.run()}
              pending={start.pending}
              disabled={!canStart || start.pending}
              className="min-h-14 px-8 text-lg"
            >
              Dar la salida
            </Button>
            {!canStart && (
              <p className="text-sm text-muted" aria-live="polite">
                Esperando a: {waitingFor.map((p) => p.nickname).join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <Button
              variant={self?.isReady ? 'secondary' : 'primary'}
              onClick={() => void ready.run(!self?.isReady)}
              pending={ready.pending}
              className="min-h-14 px-8 text-lg"
            >
              {self?.isReady ? 'Ya no estoy listo' : 'Estoy listo'}
            </Button>
            <p className="text-sm text-muted">El anfitrión iniciará la carrera.</p>
          </div>
        )}
      </div>
    </div>
  );
}
