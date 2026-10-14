import {
  createApplication,
  DEFAULT_GAME_RULES,
  type GameRules,
} from '../../src/application/index.js';
import type { RoomEvent } from '../../src/application/events.js';
import type {
  Clock,
  IdGenerator,
  Logger,
  Scheduler,
  TimerHandle,
} from '../../src/application/ports/system.js';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../../src/domain/room-code.js';
import type { RaceText } from '../../src/domain/types.js';
import { InMemoryRoomEventBus } from '../../src/infrastructure/memory/in-memory-event-bus.js';
import { InMemoryRaceResultRepository } from '../../src/infrastructure/memory/in-memory-race-result-repository.js';
import { InMemoryRoomRepository } from '../../src/infrastructure/memory/in-memory-room-repository.js';
import { InMemoryTextRepository } from '../../src/infrastructure/memory/in-memory-text-repository.js';

export class FakeClock implements Clock {
  constructor(public current = 1_000_000) {}

  now(): number {
    return this.current;
  }
}

/** Planificador manual: las tareas se ejecutan al avanzar el reloj falso. */
export class ManualScheduler implements Scheduler {
  private tasks: { handle: TimerHandle; at: number; task: () => Promise<void> }[] = [];

  constructor(private readonly clock: FakeClock) {}

  schedule(delayMs: number, task: () => Promise<void>): TimerHandle {
    const handle: TimerHandle = Symbol('timer');
    this.tasks.push({ handle, at: this.clock.now() + delayMs, task });
    return handle;
  }

  cancel(handle: TimerHandle): void {
    this.tasks = this.tasks.filter((t) => t.handle !== handle);
  }

  get pending(): number {
    return this.tasks.length;
  }

  /** Avanza el reloj y ejecuta, en orden, las tareas vencidas. */
  async advance(ms: number): Promise<void> {
    const target = this.clock.now() + ms;
    for (;;) {
      const due = this.tasks.filter((t) => t.at <= target).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      this.cancel(due.handle);
      this.clock.current = due.at;
      await due.task();
    }
    this.clock.current = target;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;
  readonly roomCodes: string[] = [];

  private next(): number {
    this.counter += 1;
    return this.counter;
  }

  playerId(): string {
    return `player-${this.next()}`;
  }

  raceId(): string {
    return `race-${this.next()}`;
  }

  playerToken(): string {
    return `token-${this.next()}`;
  }

  /** Usa `roomCodes` si hay valores encolados; si no, codifica un contador en el alfabeto. */
  roomCode(): string {
    const queued = this.roomCodes.shift();
    if (queued) return queued;
    let value = this.next();
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code = ROOM_CODE_ALPHABET.charAt(value % ROOM_CODE_ALPHABET.length) + code;
      value = Math.floor(value / ROOM_CODE_ALPHABET.length);
    }
    return code;
  }
}

export const silentLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const TEST_TEXTS: RaceText[] = [
  { id: 'text-1', content: 'hola mundo' },
  { id: 'text-2', content: 'adios mundo' },
];

/** Aplicación completa con adaptadores en memoria y tiempo controlado. */
export function createTestApp(overrides: Partial<GameRules> = {}) {
  const clock = new FakeClock();
  const scheduler = new ManualScheduler(clock);
  const rooms = new InMemoryRoomRepository();
  const bus = new InMemoryRoomEventBus();
  const results = new InMemoryRaceResultRepository();
  const ids = new SequentialIds();
  const texts = new InMemoryTextRepository(TEST_TEXTS, () => 0);
  const rules: GameRules = { ...DEFAULT_GAME_RULES, ...overrides };
  const app = createApplication({
    rooms,
    bus,
    texts,
    results,
    clock,
    ids,
    scheduler,
    logger: silentLogger,
    rules,
  });
  return { app, clock, scheduler, rooms, bus, results, ids, rules };
}

/** Consume un iterable asíncrono en segundo plano y acumula sus eventos. */
export function collect(iterable: AsyncIterable<RoomEvent>) {
  const events: RoomEvent[] = [];
  const done = (async () => {
    for await (const event of iterable) events.push(event);
  })();
  return { events, done, types: () => events.map((e) => e.type) };
}

/** Deja correr las tareas asíncronas pendientes (microtareas e I/O). */
export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
