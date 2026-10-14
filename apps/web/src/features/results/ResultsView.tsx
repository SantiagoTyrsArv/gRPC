import type { Room } from '../../api/types';
import { Alert } from '../../components/Alert';
import { Button } from '../../components/Button';
import { useAsyncAction } from '../../hooks/use-async-action';
import { setReady, startRace } from '../room/room-actions';
import { ResultsPodium } from './ResultsPodium';

interface ResultsViewProps {
  room: Room;
  selfId: string;
}

/** Resultados de la carrera y revancha en la misma sala. */
export function ResultsView({ room, selfId }: ResultsViewProps) {
  const self = room.players.find((p) => p.id === selfId);
  const ready = useAsyncAction(setReady);
  const rematch = useAsyncAction(startRace);
  const waitingFor = room.players.filter((p) => !p.isHost && !p.isReady);
  const winner = room.results.find((r) => r.position === 1);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">
          {winner?.playerId === selfId ? '¡Ganaste la carrera!' : 'Carrera terminada'}
        </h1>
        {winner && winner.playerId !== selfId && (
          <p className="mt-2 text-muted">
            {winner.nickname} cruzó primero la meta a {Math.round(winner.wpm)} palabras por minuto.
          </p>
        )}
      </div>

      <ResultsPodium results={room.results} selfId={selfId} />

      <section aria-labelledby="revancha" className="flex flex-col gap-3 border-t border-line pt-6">
        <h2 id="revancha" className="text-lg font-semibold">
          ¿Otra carrera?
        </h2>
        {ready.error && <Alert>{ready.error}</Alert>}
        {rematch.error && <Alert>{rematch.error}</Alert>}
        {self?.isHost ? (
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={() => void rematch.run()}
              pending={rematch.pending}
              disabled={waitingFor.length > 0 || rematch.pending}
            >
              Empezar la revancha
            </Button>
            {waitingFor.length > 0 && (
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
            >
              {self?.isReady ? 'Ya no quiero la revancha' : 'Quiero la revancha'}
            </Button>
            <p className="text-sm text-muted">
              {self?.isReady ? 'Esperando al anfitrión.' : 'El anfitrión iniciará la revancha.'}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
