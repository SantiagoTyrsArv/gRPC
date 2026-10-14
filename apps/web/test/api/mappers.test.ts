import { create } from '@bufbuild/protobuf';
import { timestampFromMs } from '@bufbuild/protobuf/wkt';
import { RoomStatus, WatchRoomResponseSchema } from '@typerace/proto-gen';
import { describe, expect, it } from 'vitest';
import { fromWatchRoomResponse } from '../../src/api/mappers';

describe('fromWatchRoomResponse', () => {
  it('traduce un snapshot proto al modelo del cliente', () => {
    const res = create(WatchRoomResponseSchema, {
      serverTime: timestampFromMs(5_000),
      event: {
        case: 'snapshot',
        value: {
          state: {
            roomCode: 'ABCDEF',
            status: RoomStatus.RACING,
            maxPlayers: 5,
            players: [
              { id: 'a', nickname: 'Ana', isHost: true, isReady: false, isConnected: true },
            ],
            race: {
              raceId: 'r1',
              text: 'hola',
              startAt: timestampFromMs(1_000),
              deadlineAt: timestampFromMs(121_000),
            },
            progress: [
              { playerId: 'a', typedCharsCorrect: 2, percent: 50, wpm: 40, finished: false },
            ],
          },
        },
      },
    });

    expect(fromWatchRoomResponse(res)).toEqual({
      serverTime: 5_000,
      event: {
        type: 'snapshot',
        room: {
          code: 'ABCDEF',
          status: 'RACING',
          maxPlayers: 5,
          players: [{ id: 'a', nickname: 'Ana', isHost: true, isReady: false, isConnected: true }],
          race: { id: 'r1', text: 'hola', startAt: 1_000, deadlineAt: 121_000 },
          progress: {
            a: { playerId: 'a', typedCorrect: 2, errors: 0, percent: 50, wpm: 40, finished: false },
          },
          results: [],
        },
      },
    });
  });

  it('traduce heartbeat y descarta eventos vacíos', () => {
    const heartbeat = create(WatchRoomResponseSchema, {
      serverTime: timestampFromMs(1),
      event: { case: 'heartbeat', value: {} },
    });
    expect(fromWatchRoomResponse(heartbeat)?.event).toEqual({ type: 'heartbeat' });
    expect(fromWatchRoomResponse(create(WatchRoomResponseSchema))).toBeNull();
  });
});
