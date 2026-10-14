/**
 * Mapeo dominio → Protobuf. Es el único lugar del servidor donde se mezclan
 * tipos del dominio y mensajes generados.
 */
import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import {
  LeaderboardEntrySchema,
  PlayerProgressSchema,
  PlayerResultSchema,
  PlayerSchema,
  RaceInfoSchema,
  RoomStateSchema,
  RoomStatus as ProtoRoomStatus,
  WatchRoomResponseSchema,
  type LeaderboardEntry as ProtoLeaderboardEntry,
  type Player,
  type PlayerProgress,
  type PlayerResult,
  type RaceInfo,
  type RoomState,
  type WatchRoomResponse,
} from '@typerace/proto-gen';
import type { RoomEvent } from '../application/events.js';
import type { LeaderboardEntry } from '../application/ports/race-result-repository.js';
import type {
  PlayerProgressView,
  PlayerResultView,
  PlayerView,
  RaceSetup,
  RoomStatus,
  RoomView,
} from '../domain/types.js';

const STATUS: Record<RoomStatus, ProtoRoomStatus> = {
  WAITING: ProtoRoomStatus.WAITING,
  COUNTDOWN: ProtoRoomStatus.COUNTDOWN,
  RACING: ProtoRoomStatus.RACING,
  FINISHED: ProtoRoomStatus.FINISHED,
};

export function toProtoPlayer(player: PlayerView): Player {
  return create(PlayerSchema, player);
}

export function toProtoProgress(progress: PlayerProgressView): PlayerProgress {
  return create(PlayerProgressSchema, {
    playerId: progress.playerId,
    typedCharsCorrect: progress.typedCorrect,
    percent: progress.percent,
    wpm: progress.wpm,
    finished: progress.finished,
  });
}

export function toProtoResult(result: PlayerResultView): PlayerResult {
  return create(PlayerResultSchema, result);
}

export function toProtoRace(race: RaceSetup): RaceInfo {
  return create(RaceInfoSchema, {
    raceId: race.id,
    text: race.text.content,
    startAt: timestampFromMs(race.startAt),
    deadlineAt: timestampFromMs(race.deadlineAt),
  });
}

export function toProtoRoomState(room: RoomView): RoomState {
  return create(RoomStateSchema, {
    roomCode: room.code,
    status: STATUS[room.status],
    players: room.players.map(toProtoPlayer),
    maxPlayers: room.maxPlayers,
    race: room.race ? toProtoRace(room.race) : undefined,
    progress: room.progress.map(toProtoProgress),
    results: room.results.map(toProtoResult),
  });
}

/** Traduce un evento de sala al mensaje del stream, con la hora del servidor. */
export function toWatchRoomResponse(event: RoomEvent, nowMs: number): WatchRoomResponse {
  return create(WatchRoomResponseSchema, {
    serverTime: timestampFromMs(nowMs),
    event: toProtoEvent(event),
  });
}

export function heartbeatResponse(nowMs: number): WatchRoomResponse {
  return create(WatchRoomResponseSchema, {
    serverTime: timestampFromMs(nowMs),
    event: { case: 'heartbeat', value: {} },
  });
}

function toProtoEvent(event: RoomEvent) {
  switch (event.type) {
    case 'snapshot':
      return { case: 'snapshot', value: { state: toProtoRoomState(event.room) } } as const;
    case 'playerJoined':
      return { case: 'playerJoined', value: { player: toProtoPlayer(event.player) } } as const;
    case 'playerLeft':
      return { case: 'playerLeft', value: { playerId: event.playerId } } as const;
    case 'playerReadyChanged':
      return {
        case: 'playerReadyChanged',
        value: { playerId: event.playerId, ready: event.ready },
      } as const;
    case 'playerConnectionChanged':
      return {
        case: 'playerConnectionChanged',
        value: { playerId: event.playerId, connected: event.connected },
      } as const;
    case 'hostChanged':
      return { case: 'hostChanged', value: { newHostPlayerId: event.newHostId } } as const;
    case 'countdownStarted':
      return { case: 'countdownStarted', value: { race: toProtoRace(event.race) } } as const;
    case 'raceStarted':
      return { case: 'raceStarted', value: { raceId: event.raceId } } as const;
    case 'progressUpdated':
      return {
        case: 'progressUpdated',
        value: { progress: toProtoProgress(event.progress) },
      } as const;
    case 'playerFinished':
      return { case: 'playerFinished', value: { result: toProtoResult(event.result) } } as const;
    case 'raceFinished':
      return {
        case: 'raceFinished',
        value: { raceId: event.raceId, results: event.results.map(toProtoResult) },
      } as const;
  }
}

export function toProtoLeaderboardEntry(entry: LeaderboardEntry): ProtoLeaderboardEntry {
  return create(LeaderboardEntrySchema, {
    rank: entry.rank,
    nickname: entry.nickname,
    wpm: entry.wpm,
    accuracy: entry.accuracy,
    achievedAt: timestampFromMs(entry.achievedAt),
  });
}
