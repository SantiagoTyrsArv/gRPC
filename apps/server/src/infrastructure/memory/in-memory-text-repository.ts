import type { TextRepository } from '../../application/ports/text-repository.js';
import type { RaceText } from '../../domain/types.js';

/** Textos en memoria (desarrollo sin base de datos y tests). */
export class InMemoryTextRepository implements TextRepository {
  constructor(
    private readonly texts: readonly RaceText[],
    private readonly random: () => number = Math.random,
  ) {
    if (texts.length === 0) throw new Error('Se necesita al menos un texto');
  }

  pickRandom(excludeId?: string): Promise<RaceText> {
    const candidates =
      this.texts.length > 1 ? this.texts.filter((t) => t.id !== excludeId) : this.texts;
    const index = Math.floor(this.random() * candidates.length);
    const text = candidates[index] ?? candidates[0];
    if (!text) throw new Error('No hay textos disponibles');
    return Promise.resolve(text);
  }
}
