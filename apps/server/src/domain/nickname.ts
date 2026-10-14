import { ValidationError } from './errors.js';

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;

/** Letras (cualquier idioma), números, espacio, guion bajo, guion y punto. */
const ALLOWED_PATTERN = /^[\p{L}\p{N} _.-]+$/u;

const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });

/**
 * Normaliza y valida un apodo: forma Unicode NFC, espacios colapsados y
 * recortados, longitud 2–20 (en caracteres visibles, contados como grafemas) y sin símbolos ni
 * caracteres de control.
 */
export function normalizeNickname(raw: string): string {
  const cleaned = raw.normalize('NFC').replace(/\s+/gu, ' ').trim();
  const length = Array.from(graphemes.segment(cleaned)).length;

  if (length < NICKNAME_MIN_LENGTH || length > NICKNAME_MAX_LENGTH) {
    throw new ValidationError(
      `El apodo debe tener entre ${NICKNAME_MIN_LENGTH} y ${NICKNAME_MAX_LENGTH} caracteres`,
    );
  }
  if (!ALLOWED_PATTERN.test(cleaned)) {
    throw new ValidationError(
      'El apodo solo puede contener letras, números, espacios, "_", "-" y "."',
    );
  }
  return cleaned;
}
