import { timestampMs } from '@bufbuild/protobuf/wkt';
import {
  RoomStatus as ProtoRoomStatus,
  type LeaderboardEntry as ProtoLeaderboardEntry,
  type Player as ProtoPlayer,
  type PlayerProgress as ProtoProgress,
  type PlayerResult as ProtoResult,
  type RaceInfo as ProtoRace,
  type RoomState as ProtoRoomState,
  type WatchRoomResponse,
} from '@typerace/proto-gen';
import type {
  LeaderboardEntry,
  Player,
  PlayerResult,
  Progress,
  RaceInfo,
  Room,
  RoomStatus,
  TimedRoomEvent,
  RoomEvent,
} from './types';

const STATUS: Partial<Record<ProtoRoomStatus, RoomStatus>> = {
  [ProtoRoomStatus.WAITING]: 'WAITING',
  [ProtoRoomStatus.COUNTDOWN]: 'COUNTDOWN',
  [ProtoRoomStatus.RACING]: 'RACING',
  [ProtoRoomStatus.FINISHED]: 'FINISHED',
};

export function fromProtoPlayer(p: ProtoPlayer): Player {
  return {
    id: p.id,
    nickname: p.nickname,
    isHost: p.isHost,
    isReady: p.isReady,
    isConnected: p.isConnected,
  };
}

export function fromProtoProgress(p: ProtoProgress): Progress {
  return {
    playerId: p.playerId,
    typedCorrect: p.typedCharsCorrect,
    percent: p.percent,
    wpm: p.wpm,
    finished: p.finished,
  };
}

export function fromProtoResult(r: ProtoResult): PlayerResult {
  return {
    playerId: r.playerId,
    nickname: r.nickname,
    position: r.position,
    wpm: r.wpm,
    accuracy: r.accuracy,
    elapsedMs: r.elapsedMs,
    finished: r.finished,
  };
}

export function fromProtoRace(r: ProtoRace): RaceInfo {
  return {
    id: r.raceId,
    text: r.text,
    startAt: r.startAt ? timestampMs(r.startAt) : 0,
    deadlineAt: r.deadlineAt ? timestampMs(r.deadlineAt) : 0,
  };
}

export function fromProtoRoomState(s: ProtoRoomState): Room {
  return {
    code: s.roomCode,
    status: STATUS[s.status] ?? 'WAITING',
    maxPlayers: s.maxPlayers,
    players: s.players.map(fromProtoPlayer),
    race: s.race ? fromProtoRace(s.race) : null,
    progress: Object.fromEntries(
      s.progress.map((p) => [p.playerId, fromProtoProgress(p)] as const),
    ),
    results: s.results.map(fromProtoResult),
  };
}

/** Traduce un mensaje del stream; `null` si es un evento desconocido o incompleto. */
export function fromWatchRoomResponse(res: WatchRoomResponse): TimedRoomEvent | null {
  const event = toEvent(res.event);
  if (!event) return null;
  return { event, serverTime: res.serverTime ? timestampMs(res.serverTime) : Date.now() };
}

function toEvent(e: WatchRoomResponse['event']): RoomEvent | null {
  switch (e.case) {
    case 'snapshot':
      return e.value.state ? { type: 'snapshot', room: fromProtoRoomState(e.value.state) } : null;
    case 'playerJoined':
      return e.value.player
        ? { type: 'playerJoined', player: fromProtoPlayer(e.value.player) }
        : null;
    case 'playerLeft':
      return { type: 'playerLeft', playerId: e.value.playerId };
    case 'playerReadyChanged':
      return { type: 'playerReadyChanged', playerId: e.value.playerId, ready: e.value.ready };
    case 'playerConnectionChanged':
      return {
        type: 'playerConnectionChanged',
        playerId: e.value.playerId,
        connected: e.value.connected,
      };
    case 'hostChanged':
      return { type: 'hostChanged', newHostId: e.value.newHostPlayerId };
    case 'countdownStarted':
      return e.value.race ? { type: 'countdownStarted', race: fromProtoRace(e.value.race) } : null;
    case 'raceStarted':
      return { type: 'raceStarted', raceId: e.value.raceId };
    case 'progressUpdated':
      return e.value.progress
        ? { type: 'progressUpdated', progress: fromProtoProgress(e.value.progress) }
        : null;
    case 'playerFinished':
      return e.value.result
        ? { type: 'playerFinished', result: fromProtoResult(e.value.result) }
        : null;
    case 'raceFinished':
      return {
        type: 'raceFinished',
        raceId: e.value.raceId,
        results: e.value.results.map(fromProtoResult),
      };
    case 'heartbeat':
      return { type: 'heartbeat' };
    case undefined:
      return null;
  }
}

export function fromProtoLeaderboardEntry(e: ProtoLeaderboardEntry): LeaderboardEntry {
  return {
    rank: e.rank,
    nickname: e.nickname,
    wpm: e.wpm,
    accuracy: e.accuracy,
    achievedAt: new Date(e.achievedAt ? timestampMs(e.achievedAt) : 0),
  };
}
