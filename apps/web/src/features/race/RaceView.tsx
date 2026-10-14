import type { Room } from '../../api/types';
import { useNow } from '../../hooks/use-now';
import type { ClockSync } from '../../lib/clock';
import { calculateAccuracy, calculateWpm, formatPercent } from '../../lib/stats';
import { Countdown } from './Countdown';
import { ProgressTrack } from './ProgressTrack';
import { TypingArea } from './TypingArea';
import { useProgressReporter } from './use-progress-reporter';
import { useTypingEngine } from './use-typing-engine';

interface RaceViewProps {
  room: Room;
  selfId: string;
  clock: ClockSync;
}

/** Cuenta regresiva + carrera: pista en vivo y área de escritura. */
export function RaceView({ room, selfId, clock }: RaceViewProps) {
  const race = room.race;
  const now = clock.serverNow(useNow(100));
  const text = race?.text ?? '';

  const started = race !== null && now >= race.startAt;
  const serverProgress = room.progress[selfId];
  const finishedByServer = serverProgress?.finished ?? false;
  // Al recargar en plena carrera, se reanuda desde lo que el servidor ya aceptó.
  const engine = useTypingEngine(text, started && !finishedByServer, {
    position: serverProgress?.typedCorrect ?? 0,
    errors: serverProgress?.errors ?? 0,
  });
  const { position, errors, finished } = engine.state;

  useProgressReporter(
    { raceId: race?.id ?? '', typedCorrect: position, errors },
    { active: started && room.status !== 'FINISHED', finished },
  );

  if (!race) return null;

  const elapsed = Math.max(0, now - race.startAt);
  // Durante la cuenta regresiva se muestra la duración completa de la carrera.
  const remaining = Math.max(0, race.deadlineAt - Math.max(now, race.startAt));
  // Tras terminar, el WPM queda fijado por el servidor (si no, seguiría bajando con el tiempo).
  const wpm = finishedByServer
    ? (room.progress[selfId]?.wpm ?? 0)
    : calculateWpm(position, elapsed);
  const percent = (position / race.text.length) * 100;
  const selfResult = room.results.find((r) => r.playerId === selfId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-3xl sm:text-4xl">
          {started ? 'En carrera' : 'Preparados'}
        </h1>
        <p className="text-sm text-muted tabular-nums" aria-live="off">
          Tiempo restante:{' '}
          <span className="font-display text-xl text-ink">{Math.ceil(remaining / 1000)} s</span>
        </p>
      </div>

      {!started && <Countdown remainingMs={race.startAt - now} />}

      <ProgressTrack
        players={room.players}
        progress={room.progress}
        selfId={selfId}
        elapsedMs={elapsed}
        selfOverride={{ percent, wpm, finished }}
      />

      <TypingArea engine={engine} enabled={started && !finished} />

      <dl className="grid grid-cols-3 gap-4 border-t border-line pt-4 text-center sm:max-w-md">
        <div>
          <dt className="text-sm text-muted">Velocidad</dt>
          <dd className="font-display text-2xl tabular-nums">{Math.round(wpm)} ppm</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Precisión</dt>
          <dd className="font-display text-2xl tabular-nums">
            {formatPercent(calculateAccuracy(position, errors))}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Avance</dt>
          <dd className="font-display text-2xl tabular-nums">{Math.floor(percent)}%</dd>
        </div>
      </dl>

      {finished && (
        <p role="status" className="rounded-md bg-flag px-4 py-3 font-semibold text-flag-ink">
          {selfResult
            ? `¡Llegaste a la meta en la posición ${selfResult.position}! Esperando al resto de jugadores…`
            : '¡Llegaste a la meta! Esperando al resto de jugadores…'}
        </p>
      )}
    </div>
  );
}
