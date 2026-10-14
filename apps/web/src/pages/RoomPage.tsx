import { useState, type SyntheticEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Alert } from '../components/Alert';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { useAsyncAction } from '../hooks/use-async-action';
import { LobbyView } from '../features/lobby/LobbyView';
import { RaceView } from '../features/race/RaceView';
import { ResultsView } from '../features/results/ResultsView';
import { joinRoom, leaveRoom } from '../features/room/room-actions';
import { useRoomStream } from '../features/room/use-room-stream';
import { useNicknameStore, useSessionStore } from '../stores/session-store';
import { nicknameError } from '../lib/validation';

/** Unirse a la sala desde un enlace compartido (o tras perder la sesión). */
function JoinPanel({ code, expired }: { code: string; expired: boolean }) {
  const lastNickname = useNicknameStore((s) => s.lastNickname);
  const [nickname, setNickname] = useState(lastNickname);
  const [formError, setFormError] = useState<string | null>(null);
  const join = useAsyncAction(joinRoom);

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    const error = nicknameError(nickname);
    setFormError(error);
    if (!error) void join.run(nickname, code);
  };

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl">Sala {code}</h1>
        <p className="text-muted">
          Te invitaron a una carrera. Elige tu apodo para entrar a la parrilla de salida.
        </p>
      </div>
      {expired && (
        <Alert tone="info">Tu sesión en esta sala terminó. Puedes volver a unirte.</Alert>
      )}
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <TextField
          label="Tu apodo"
          value={nickname}
          maxLength={20}
          autoComplete="nickname"
          onChange={(e) => {
            setNickname(e.target.value);
          }}
        />
        {(formError ?? join.error) && <Alert>{formError ?? join.error}</Alert>}
        <Button type="submit" pending={join.pending}>
          Unirme a la sala
        </Button>
      </form>
    </div>
  );
}

/** Lobby → carrera → resultados en la misma ruta `/room/:code`. */
export function RoomPage() {
  const code = (useParams().code ?? '').toUpperCase();
  const navigate = useNavigate();
  const selfId = useSessionStore((s) => (s.session?.roomCode === code ? s.session.playerId : null));
  const { room, status, clock } = useRoomStream(code);
  const leave = useAsyncAction(leaveRoom);

  if (status === 'no-session' || status === 'expired' || !selfId) {
    return <JoinPanel code={code} expired={status === 'expired'} />;
  }

  if (!room) {
    return (
      <p role="status" className="text-muted">
        {status === 'reconnecting'
          ? 'No se pudo conectar con la sala. Reintentando…'
          : 'Conectando con la sala…'}
      </p>
    );
  }

  const onLeave = async () => {
    await leave.run();
    void navigate('/');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm">
          {status === 'reconnecting' ? (
            <span className="rounded-md bg-error-bg px-3 py-1.5 font-semibold">
              Conexión perdida. Reconectando…
            </span>
          ) : (
            <span className="text-muted">Sala {room.code}</span>
          )}
        </p>
        <Button variant="ghost" onClick={() => void onLeave()} pending={leave.pending}>
          Salir de la sala
        </Button>
      </div>

      {room.status === 'WAITING' && <LobbyView room={room} selfId={selfId} />}
      {(room.status === 'COUNTDOWN' || room.status === 'RACING') && (
        <RaceView key={room.race?.id} room={room} selfId={selfId} clock={clock} />
      )}
      {room.status === 'FINISHED' && <ResultsView room={room} selfId={selfId} />}
    </div>
  );
}
