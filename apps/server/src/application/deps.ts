import type { GameRules } from './game-rules.js';
import type { RaceResultRepository } from './ports/race-result-repository.js';
import type { RoomEventBus } from './ports/room-event-bus.js';
import type { RoomRepository } from './ports/room-repository.js';
import type { Clock, IdGenerator, Logger, Scheduler } from './ports/system.js';
import type { TextRepository } from './ports/text-repository.js';

/** Conjunto de puertos que reciben los casos de uso (cada uno toma lo que necesita). */
export interface AppDeps {
  rooms: RoomRepository;
  bus: RoomEventBus;
  texts: TextRepository;
  results: RaceResultRepository;
  clock: Clock;
  ids: IdGenerator;
  scheduler: Scheduler;
  logger: Logger;
  rules: GameRules;
}
