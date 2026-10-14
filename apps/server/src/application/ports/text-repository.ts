import type { RaceText } from '../../domain/types.js';

export interface TextRepository {
  /** Devuelve un texto aleatorio, evitando `excludeId` si hay alternativas. */
  pickRandom(excludeId?: string): Promise<RaceText>;
}
