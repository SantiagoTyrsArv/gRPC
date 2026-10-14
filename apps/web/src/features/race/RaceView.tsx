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

const SECTORS = 3;

function formatClock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Avance propio dividido en tres sectores, como en la telemetría. */
function SectorBar({ percent }: { percent: number }) {
  const size = 100 / SECTORS;
  return (
    <div aria-hidden="true" className="flex gap-1.5">
      {Array.from({ length: SECTORS }, (_, i) => {
        const fill = Math.max(0, Math.min(1, (percent - i * size) / size));
        return (
          <div key={i} className="flex flex-1 flex-col gap-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-lane">
              <div
                className={`h-full transition-[width] duration-300 ${fill === 1 ? 'bg-correct' : 'bg-ink'}`}
                style={{ width: `${fill * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted">Sector {i + 1}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Semáforo + carrera: texto a escribir, telemetría propia y torre de tiempos. */
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
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:gap-8">
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className="font-display text-4xl sm:text-5xl">
          {started ? 'En carrera' : 'Preparados'}
        </h1>

        {!started && <Countdown remainingMs={race.startAt - now} />}

        {finished && (
          <p role="status" className="rounded-lg bg-correct px-4 py-3 font-semibold text-bg">
            {selfResult
              ? `Llegaste a la meta en la posición ${selfResult.position}. Esperando al resto de jugadores…`
              : 'Llegaste a la meta. Esperando al resto de jugadores…'}
          </p>
        )}

        <TypingArea engine={engine} enabled={started && !finished} />

        <div className="flex flex-col gap-4 rounded-lg bg-surface p-4">
          <dl className="grid grid-cols-3 gap-4">
            <div>
              <dt className="text-sm text-muted">Velocidad</dt>
              <dd className="font-num text-3xl">
                {Math.round(wpm)} <span className="text-base font-medium text-muted">ppm</span>
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Precisión</dt>
              <dd className="font-num text-3xl">
                {formatPercent(calculateAccuracy(position, errors))}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Avance</dt>
              <dd className="font-num text-3xl">{Math.floor(percent)}%</dd>
            </div>
          </dl>
          <SectorBar percent={percent} />
        </div>
      </div>

      <div className="lg:sticky lg:top-6">
        <ProgressTrack
          players={room.players}
          progress={room.progress}
          results={room.results}
          selfId={selfId}
          elapsedMs={elapsed}
          selfOverride={{ typedCorrect: position, percent, wpm, finished }}
          heading={{
            title: started ? 'Carrera en vivo' : 'Parrilla de salida',
            detail: formatClock(remaining),
            live: started && room.status === 'RACING',
          }}
        />
      </div>
    </div>
  );
}
