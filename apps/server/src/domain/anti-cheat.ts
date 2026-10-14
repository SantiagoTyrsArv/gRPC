import { CheatDetectedError, ValidationError } from './errors.js';
import { CHARS_PER_WORD } from './stats.js';

export interface ProgressCheck {
  previousCorrect: number;
  previousErrors: number;
  nextCorrect: number;
  nextErrors: number;
  textLength: number;
  /** Instante de inicio de la carrera (ms epoch, reloj del servidor). */
  startAt: number;
  /** Instante de recepción en el servidor (ms epoch). */
  now: number;
  maxWpm: number;
  /**
   * Holgura que se suma al tiempo transcurrido al calcular el WPM máximo, para
   * tolerar desfases de reloj y latencia de red al inicio de la carrera.
   */
  graceMs: number;
}

/**
 * Valida un reporte de progreso. Lanza `CheatDetectedError` si el reporte es
 * imposible: antes del inicio, retrocede, supera el texto o implica un WPM
 * inalcanzable para un humano.
 */
export function assertValidProgress(check: ProgressCheck): void {
  const { nextCorrect, nextErrors } = check;
  if (!isNonNegativeInteger(nextCorrect) || !isNonNegativeInteger(nextErrors)) {
    throw new ValidationError('El progreso debe expresarse con enteros no negativos');
  }
  if (check.now < check.startAt) {
    throw new CheatDetectedError('BEFORE_START', 'La carrera todavía no ha comenzado');
  }
  if (nextCorrect < check.previousCorrect) {
    throw new CheatDetectedError('PROGRESS_REGRESSION', 'El progreso no puede retroceder');
  }
  if (nextErrors < check.previousErrors) {
    throw new CheatDetectedError('ERRORS_REGRESSION', 'Los errores no pueden disminuir');
  }
  if (nextCorrect > check.textLength) {
    throw new CheatDetectedError('EXCEEDS_TEXT', 'El progreso supera la longitud del texto');
  }

  const elapsedMinutes = (check.now - check.startAt + check.graceMs) / 60_000;
  const wpm = nextCorrect / CHARS_PER_WORD / elapsedMinutes;
  if (wpm > check.maxWpm) {
    throw new CheatDetectedError('IMPOSSIBLE_WPM', 'Velocidad de escritura imposible');
  }
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}
