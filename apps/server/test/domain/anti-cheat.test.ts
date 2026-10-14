import { describe, expect, it } from 'vitest';
import { assertValidProgress, type ProgressCheck } from '../../src/domain/anti-cheat.js';
import { CheatDetectedError, ValidationError } from '../../src/domain/errors.js';

const base: ProgressCheck = {
  previousCorrect: 10,
  previousErrors: 1,
  nextCorrect: 20,
  nextErrors: 2,
  textLength: 200,
  startAt: 100_000,
  now: 110_000, // 10 s después del inicio
  maxWpm: 250,
  graceMs: 1_000,
};

function reasonOf(check: Partial<ProgressCheck>): string | null {
  try {
    assertValidProgress({ ...base, ...check });
    return null;
  } catch (error) {
    if (error instanceof CheatDetectedError) return error.reason;
    throw error;
  }
}

describe('assertValidProgress', () => {
  it('acepta un progreso razonable', () => {
    expect(reasonOf({})).toBeNull();
  });

  it('acepta un reporte sin cambios (reenvío)', () => {
    expect(reasonOf({ nextCorrect: 10, nextErrors: 1 })).toBeNull();
  });

  it('acepta completar exactamente el texto', () => {
    expect(reasonOf({ nextCorrect: 200, now: 200_000 })).toBeNull();
  });

  it('rechaza progreso antes del inicio', () => {
    expect(reasonOf({ now: 99_999 })).toBe('BEFORE_START');
  });

  it('rechaza progreso que retrocede', () => {
    expect(reasonOf({ nextCorrect: 9 })).toBe('PROGRESS_REGRESSION');
  });

  it('rechaza errores que disminuyen', () => {
    expect(reasonOf({ nextErrors: 0 })).toBe('ERRORS_REGRESSION');
  });

  it('rechaza superar la longitud del texto', () => {
    expect(reasonOf({ nextCorrect: 201, now: 300_000 })).toBe('EXCEEDS_TEXT');
  });

  it('rechaza un WPM imposible (> 250)', () => {
    // 200 caracteres en 10 s (+1 s de holgura) ≈ 218 WPM → válido
    expect(reasonOf({ nextCorrect: 200 })).toBeNull();
    // 200 caracteres en 5 s (+1 s) = 400 WPM → trampa
    expect(reasonOf({ nextCorrect: 200, now: 105_000 })).toBe('IMPOSSIBLE_WPM');
  });

  it('la holgura tolera ráfagas justo al inicio', () => {
    // 10 caracteres a los 200 ms: sin holgura serían 600 WPM
    expect(reasonOf({ previousCorrect: 0, nextCorrect: 10, now: 100_200 })).toBeNull();
    expect(reasonOf({ previousCorrect: 0, nextCorrect: 10, now: 100_200, graceMs: 0 })).toBe(
      'IMPOSSIBLE_WPM',
    );
  });

  it('rechaza valores no enteros o negativos', () => {
    expect(() => {
      assertValidProgress({ ...base, nextCorrect: 12.5 });
    }).toThrow(ValidationError);
    expect(() => {
      assertValidProgress({ ...base, nextErrors: -1 });
    }).toThrow(ValidationError);
  });
});
