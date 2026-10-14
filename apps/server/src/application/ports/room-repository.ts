import type { Room } from '../../domain/room.js';

/**
 * Almacenamiento de salas activas. La implementación actual es en memoria; la
 * interfaz permite migrar a Redis sin tocar dominio ni casos de uso.
 */
export interface RoomRepository {
  save(room: Room): Promise<void>;
  findByCode(code: string): Promise<Room | undefined>;
  findByPlayerToken(token: string): Promise<Room | undefined>;
  exists(code: string): Promise<boolean>;
  delete(code: string): Promise<void>;
  listAll(): Promise<Room[]>;
}
