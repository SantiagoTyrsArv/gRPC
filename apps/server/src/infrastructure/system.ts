import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type {
  Clock,
  IdGenerator,
  Logger,
  Scheduler,
  TimerHandle,
} from '../application/ports/system.js';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '../domain/room-code.js';

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

/** Identificadores con aleatoriedad criptográfica. */
export class CryptoIdGenerator implements IdGenerator {
  playerId(): string {
    return randomUUID();
  }

  raceId(): string {
    return randomUUID();
  }

  playerToken(): string {
    return randomBytes(32).toString('base64url');
  }

  roomCode(): string {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length));
    }
    return code;
  }
}

/** Planificador basado en `setTimeout`; los errores de las tareas se registran. */
export class TimeoutScheduler implements Scheduler {
  private readonly handles = new Map<TimerHandle, NodeJS.Timeout>();

  constructor(private readonly logger: Logger) {}

  schedule(delayMs: number, task: () => Promise<void>): TimerHandle {
    const handle: TimerHandle = Symbol('timer');
    const timeout = setTimeout(() => {
      this.handles.delete(handle);
      task().catch((error: unknown) => {
        this.logger.error({ err: error }, 'Fallo en tarea programada');
      });
    }, delayMs);
    this.handles.set(handle, timeout);
    return handle;
  }

  cancel(handle: TimerHandle): void {
    clearTimeout(this.handles.get(handle));
    this.handles.delete(handle);
  }

  /** Cancela todo (apagado ordenado). */
  cancelAll(): void {
    for (const timeout of this.handles.values()) clearTimeout(timeout);
    this.handles.clear();
  }
}
