import { useEffect, useReducer, useState } from 'react';
import { roomClient } from '../../api/client';
import { isUnauthenticated } from '../../api/errors';
import { fromWatchRoomResponse } from '../../api/mappers';
import { backoffDelay } from '../../lib/backoff';
import { ClockSync } from '../../lib/clock';
import { useSessionStore } from '../../stores/session-store';
import { roomReducer } from './room-reducer';

/**
 * - `no-session`: no hay sesión para esta sala (hay que unirse).
 * - `connecting`: primera conexión.
 * - `live`: recibiendo eventos.
 * - `reconnecting`: se perdió la conexión; reintentando con backoff.
 * - `expired`: el servidor ya no reconoce el token (sala cerrada o expulsado).
 */
export type StreamStatus = 'no-session' | 'connecting' | 'live' | 'reconnecting' | 'expired';

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

/**
 * Se suscribe a `WatchRoom` y mantiene el estado de la sala. Reconecta
 * automáticamente con backoff exponencial; tras reconectar, el `snapshot`
 * inicial restablece el estado completo.
 */
export function useRoomStream(code: string) {
  const session = useSessionStore((s) => s.session);
  const clearSession = useSessionStore((s) => s.clearSession);
  const [room, dispatch] = useReducer(roomReducer, null);
  // El estado se asocia al token para no arrastrarlo entre sesiones distintas.
  const [stream, setStream] = useState<{ token: string; status: StreamStatus } | null>(null);
  // Objeto estable durante la vida del componente (muta internamente al muestrear).
  const [clock] = useState(() => new ClockSync());

  const token = session?.roomCode === code ? session.playerToken : null;

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const { signal } = controller;
    // Función (no propiedad) para que TypeScript no asuma el valor tras cada `await`.
    const aborted = () => signal.aborted;
    const setStatus = (status: StreamStatus) => {
      setStream({ token, status });
    };
    clock.reset();

    async function run(): Promise<void> {
      // Al recargar la página, `Reconnect` valida el token guardado antes de suscribirse.
      try {
        await roomClient.reconnect({}, { signal });
      } catch (error) {
        if (aborted()) return;
        if (isUnauthenticated(error)) {
          setStatus('expired');
          clearSession();
          return;
        }
        // Errores de red: el bucle siguiente reintenta con backoff.
      }

      let attempt = 0;
      while (!aborted()) {
        setStatus(attempt === 0 ? 'connecting' : 'reconnecting');
        try {
          for await (const response of roomClient.watchRoom({}, { signal })) {
            const timed = fromWatchRoomResponse(response);
            if (!timed) continue;
            clock.sample(timed.serverTime, Date.now());
            if (timed.event.type === 'snapshot') {
              attempt = 0;
              setStatus('live');
            }
            dispatch(timed.event);
          }
        } catch (error) {
          if (aborted()) return;
          if (isUnauthenticated(error)) {
            setStatus('expired');
            clearSession();
            return;
          }
        }
        // El stream terminó (error de red o cierre del servidor): reintentar.
        if (aborted()) return;
        setStatus('reconnecting');
        await sleep(backoffDelay(attempt), signal);
        attempt += 1;
      }
    }

    void run();
    return () => {
      controller.abort();
    };
  }, [token, clearSession, clock]);

  let status: StreamStatus;
  if (token) status = stream?.token === token ? stream.status : 'connecting';
  else status = stream?.status === 'expired' ? 'expired' : 'no-session';

  return { room, status, clock };
}
