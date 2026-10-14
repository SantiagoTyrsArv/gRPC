import { describe, expect, it } from 'vitest';
import { backoffDelay } from '../../src/lib/backoff';
import { ClockSync } from '../../src/lib/clock';
import { calculateAccuracy, calculateWpm, formatPercent } from '../../src/lib/stats';
import { nicknameError } from '../../src/lib/validation';

describe('ClockSync', () => {
  it('usa la muestra con menor latencia (mayor desfase)', () => {
    const clock = new ClockSync();
    expect(clock.offsetMs).toBe(0);
    clock.sample(10_000, 9_000); // servidor adelantado 1000 ms (latencia alta)
    clock.sample(10_500, 9_300); // muestra más rápida: 1200 ms
    clock.sample(11_000, 9_900); // 1100 ms
    expect(clock.offsetMs).toBe(1_200);
    expect(clock.serverNow(20_000)).toBe(21_200);
  });
});

describe('backoffDelay', () => {
  it('crece exponencialmente con tope y jitter acotado', () => {
    const noJitter = { random: () => 0.5 };
    expect(backoffDelay(0, noJitter)).toBe(500);
    expect(backoffDelay(1, noJitter)).toBe(1_000);
    expect(backoffDelay(3, noJitter)).toBe(4_000);
    expect(backoffDelay(10, noJitter)).toBe(10_000);
    expect(backoffDelay(0, { random: () => 0 })).toBe(400);
    expect(backoffDelay(0, { random: () => 1 })).toBe(600);
  });
});

describe('stats', () => {
  it('calcula WPM y precisión como el servidor', () => {
    expect(calculateWpm(250, 60_000)).toBe(50);
    expect(calculateWpm(0, 1_000)).toBe(0);
    expect(calculateAccuracy(90, 10)).toBe(0.9);
    expect(formatPercent(0.9567)).toBe('95.7%');
  });
});

describe('nicknameError', () => {
  it('valida la longitud del apodo', () => {
    expect(nicknameError('Ana')).toBeNull();
    expect(nicknameError(' a ')).not.toBeNull();
    expect(nicknameError('x'.repeat(21))).not.toBeNull();
  });
});
