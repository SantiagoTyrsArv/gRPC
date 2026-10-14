import { ValidationError } from './errors.js';

/** Alfabeto sin caracteres ambiguos (0/O, 1/I). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 6;

const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Normaliza (mayúsculas, sin espacios) y valida un código de sala. */
export function normalizeRoomCode(raw: string): string {
  const code = raw.trim().toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) {
    throw new ValidationError(
      `El código de sala debe tener ${ROOM_CODE_LENGTH} caracteres alfanuméricos`,
    );
  }
  return code;
}
