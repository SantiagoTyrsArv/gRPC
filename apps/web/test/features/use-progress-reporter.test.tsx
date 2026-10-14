import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PROGRESS_INTERVAL_MS,
  useProgressReporter,
} from '../../src/features/race/use-progress-reporter';

const submitProgress = vi.hoisted(() => vi.fn((_req: unknown) => Promise.resolve({})));

vi.mock('../../src/api/client', () => ({
  raceClient: { submitProgress },
}));

describe('useProgressReporter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    submitProgress.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('envía como máximo una vez por intervalo y solo si hubo cambios', async () => {
    const { rerender } = renderHook(
      ({ typed }) => {
        useProgressReporter(
          { raceId: 'r1', typedCorrect: typed, errors: 0 },
          { active: true, finished: false },
        );
      },
      { initialProps: { typed: 1 } },
    );

    // Varias pulsaciones dentro del mismo intervalo → un solo envío con el último valor.
    rerender({ typed: 2 });
    rerender({ typed: 3 });
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS);
    expect(submitProgress).toHaveBeenCalledTimes(1);
    expect(submitProgress).toHaveBeenLastCalledWith({
      raceId: 'r1',
      typedCharsCorrect: 3,
      errors: 0,
    });

    // Sin cambios no se reenvía.
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS * 3);
    expect(submitProgress).toHaveBeenCalledTimes(1);
  });

  it('envía de inmediato al terminar y no envía si está inactivo', async () => {
    const { rerender } = renderHook(
      ({ active, finished }) => {
        useProgressReporter(
          { raceId: 'r1', typedCorrect: finished ? 4 : 0, errors: 0 },
          { active, finished },
        );
      },
      { initialProps: { active: false, finished: false } },
    );
    await vi.advanceTimersByTimeAsync(PROGRESS_INTERVAL_MS * 2);
    expect(submitProgress).not.toHaveBeenCalled();

    rerender({ active: true, finished: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(submitProgress).toHaveBeenCalledWith({
      raceId: 'r1',
      typedCharsCorrect: 4,
      errors: 0,
    });
  });
});
