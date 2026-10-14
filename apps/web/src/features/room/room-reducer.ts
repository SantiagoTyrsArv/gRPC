import type { Player, Progress, Room, RoomEvent } from '../../api/types';

function emptyProgress(playerId: string): Progress {
  return { playerId, typedCorrect: 0, percent: 0, wpm: 0, finished: false };
}

function updatePlayer(room: Room, playerId: string, patch: Partial<Player>): Room {
  return {
    ...room,
    players: room.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
  };
}

/**
 * Reduce los eventos del stream a un estado de sala (patrón reducer, puro).
 * El `snapshot` reemplaza todo el estado; los demás eventos son incrementales
 * e idempotentes (un evento repetido tras reconectar no rompe el estado).
 */
export function roomReducer(room: Room | null, event: RoomEvent): Room | null {
  if (event.type === 'snapshot') return event.room;
  if (!room) return null;

  switch (event.type) {
    case 'playerJoined': {
      const others = room.players.filter((p) => p.id !== event.player.id);
      return { ...room, players: [...others, event.player] };
    }
    case 'playerLeft': {
      const { [event.playerId]: _removed, ...progress } = room.progress;
      return {
        ...room,
        players: room.players.filter((p) => p.id !== event.playerId),
        progress,
      };
    }
    case 'playerReadyChanged':
      return updatePlayer(room, event.playerId, { isReady: event.ready });
    case 'playerConnectionChanged':
      return updatePlayer(room, event.playerId, { isConnected: event.connected });
    case 'hostChanged':
      return {
        ...room,
        players: room.players.map((p) => ({ ...p, isHost: p.id === event.newHostId })),
      };
    case 'countdownStarted':
      return {
        ...room,
        status: 'COUNTDOWN',
        race: event.race,
        results: [],
        progress: Object.fromEntries(room.players.map((p) => [p.id, emptyProgress(p.id)])),
      };
    case 'raceStarted':
      return room.race?.id === event.raceId ? { ...room, status: 'RACING' } : room;
    case 'progressUpdated':
      return {
        ...room,
        progress: { ...room.progress, [event.progress.playerId]: event.progress },
      };
    case 'playerFinished': {
      const results = room.results.filter((r) => r.playerId !== event.result.playerId);
      return { ...room, results: [...results, event.result] };
    }
    case 'raceFinished':
      return {
        ...room,
        status: 'FINISHED',
        results: event.results,
        players: room.players.map((p) => ({ ...p, isReady: false })),
      };
    case 'heartbeat':
      return room;
  }
}
