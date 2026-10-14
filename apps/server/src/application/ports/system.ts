/** Reloj inyectable (ms epoch) para que la lógica temporal sea testeable. */
export interface Clock {
  now(): number;
}

export interface IdGenerator {
  playerId(): string;
  raceId(): string;
  /** Secreto aleatorio, no adivinable. */
  playerToken(): string;
  roomCode(): string;
}

export type TimerHandle = symbol;

/** Planificador de tareas diferidas (temporizadores de la carrera). */
export interface Scheduler {
  schedule(delayMs: number, task: () => Promise<void>): TimerHandle;
  cancel(handle: TimerHandle): void;
}

/** Subconjunto de la API de pino que usa la aplicación. */
export interface Logger {
  debug(obj: object, msg: string): void;
  info(obj: object, msg: string): void;
  warn(obj: object, msg: string): void;
  error(obj: object, msg: string): void;
}
