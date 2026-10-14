import { describe, expect, it } from 'vitest';
import { calculateAccuracy, calculatePercent, calculateWpm } from '../../src/domain/stats.js';

describe('calculateWpm', () => {
  it('aplica (caracteres / 5) / minutos', () => {
    // 250 caracteres = 50 palabras en 1 minuto
    expect(calculateWpm(250, 60_000)).toBe(50);
    // 100 caracteres = 20 palabras en 30 s → 40 WPM
    expect(calculateWpm(100, 30_000)).toBe(40);
  });

  it('redondea a un decimal', () => {
    expect(calculateWpm(101, 60_000)).toBe(20.2);
    expect(calculateWpm(7, 7_000)).toBe(12);
  });

  it('devuelve 0 sin tiempo o sin caracteres', () => {
    expect(calculateWpm(0, 10_000)).toBe(0);
    expect(calculateWpm(50, 0)).toBe(0);
    expect(calculateWpm(50, -5)).toBe(0);
  });
});

describe('calculateAccuracy', () => {
  it('calcula correctos / (correctos + errores)', () => {
    expect(calculateAccuracy(90, 10)).toBe(0.9);
    expect(calculateAccuracy(2, 1)).toBe(0.6667);
  });

  it('es 1 sin errores o sin pulsaciones', () => {
    expect(calculateAccuracy(120, 0)).toBe(1);
    expect(calculateAccuracy(0, 0)).toBe(1);
  });

  it('es 0 si solo hay errores', () => {
    expect(calculateAccuracy(0, 4)).toBe(0);
  });
});

describe('calculatePercent', () => {
  it('calcula el avance y lo limita a 100', () => {
    expect(calculatePercent(50, 200)).toBe(25);
    expect(calculatePercent(1, 3)).toBe(33.3);
    expect(calculatePercent(300, 200)).toBe(100);
    expect(calculatePercent(0, 200)).toBe(0);
    expect(calculatePercent(10, 0)).toBe(0);
  });
});
