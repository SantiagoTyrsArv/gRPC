import { useCallback, useEffect, useRef } from 'react';
import { raceClient } from '../../api/client';

/** Intervalo mínimo entre envíos de progreso (throttle). */
export const PROGRESS_INTERVAL_MS = 200;

interface ProgressSnapshot {
  raceId: string;
  typedCorrect: number;
  errors: number;
}

/**
 * Envía el progreso al servidor como máximo una vez cada 200 ms (no por tecla)
 * y solo si cambió. Al terminar el texto envía de inmediato; si había un envío
 * en curso, el siguiente ciclo del intervalo envía el estado final.
 */
export function useProgressReporter(
  progress: ProgressSnapshot,
  { active, finished }: { active: boolean; finished: boolean },
): void {
  const latest = useRef(progress);
  useEffect(() => {
    latest.current = progress;
  });
  const lastSent = useRef('');
  const inFlight = useRef(false);

  const send = useCallback(async (): Promise<void> => {
    const current = latest.current;
    const key = `${current.raceId}:${current.typedCorrect}:${current.errors}`;
    if (inFlight.current || key === lastSent.current) return;
    inFlight.current = true;
    try {
      await raceClient.submitProgress({
        raceId: current.raceId,
        typedCharsCorrect: current.typedCorrect,
        errors: current.errors,
      });
      lastSent.current = key;
    } catch (error) {
      // Un reporte rechazado no detiene la carrera: el siguiente ciclo reintenta.
      console.warn('Progreso no aceptado por el servidor', error);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => void send(), PROGRESS_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, [active, send]);

  useEffect(() => {
    if (active && finished) void send();
  }, [active, finished, send]);
}
