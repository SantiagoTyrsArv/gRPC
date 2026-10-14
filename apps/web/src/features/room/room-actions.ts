import { raceClient, roomClient } from '../../api/client';
import type { PlayerSession } from '../../api/types';
import { useSessionStore } from '../../stores/session-store';

/**
 * Acciones de sala. Encapsulan las llamadas RPC unarias y la actualización de
 * la sesión, para que los componentes no contengan lógica de red.
 */

function saveSession(
  session: { roomCode: string; playerId: string; playerToken: string } | undefined,
  nickname: string,
): PlayerSession {
  if (!session) throw new Error('El servidor no devolvió una sesión');
  const full = { ...session, nickname };
  useSessionStore.getState().setSession(full);
  return full;
}

export async function createRoom(nickname: string): Promise<PlayerSession> {
  const res = await roomClient.createRoom({ nickname });
  return saveSession(res.session, nickname.trim());
}

export async function joinRoom(nickname: string, roomCode: string): Promise<PlayerSession> {
  const res = await roomClient.joinRoom({ nickname, roomCode: roomCode.trim().toUpperCase() });
  return saveSession(res.session, nickname.trim());
}

export async function setReady(ready: boolean): Promise<void> {
  await roomClient.setReady({ ready });
}

export async function startRace(): Promise<void> {
  await raceClient.startRace({});
}

export async function leaveRoom(): Promise<void> {
  try {
    await roomClient.leaveRoom({});
  } finally {
    useSessionStore.getState().clearSession();
  }
}
