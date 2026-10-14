import type { RoomRepository } from '../../application/ports/room-repository.js';
import type { Room } from '../../domain/room.js';

/**
 * Salas en memoria del proceso. Mantiene un índice token → sala que se
 * reconstruye en cada `save` (los jugadores pueden haber entrado o salido).
 */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();
  private readonly tokenIndex = new Map<string, string>();
  private readonly tokensByRoom = new Map<string, Set<string>>();

  save(room: Room): Promise<void> {
    this.rooms.set(room.code, room);
    this.unindex(room.code);
    const tokens = new Set(room.listPlayers().map((p) => p.token));
    for (const token of tokens) this.tokenIndex.set(token, room.code);
    this.tokensByRoom.set(room.code, tokens);
    return Promise.resolve();
  }

  findByCode(code: string): Promise<Room | undefined> {
    return Promise.resolve(this.rooms.get(code));
  }

  findByPlayerToken(token: string): Promise<Room | undefined> {
    const code = this.tokenIndex.get(token);
    return Promise.resolve(code ? this.rooms.get(code) : undefined);
  }

  exists(code: string): Promise<boolean> {
    return Promise.resolve(this.rooms.has(code));
  }

  delete(code: string): Promise<void> {
    this.rooms.delete(code);
    this.unindex(code);
    return Promise.resolve();
  }

  listAll(): Promise<Room[]> {
    return Promise.resolve([...this.rooms.values()]);
  }

  private unindex(code: string): void {
    for (const token of this.tokensByRoom.get(code) ?? []) this.tokenIndex.delete(token);
    this.tokensByRoom.delete(code);
  }
}
