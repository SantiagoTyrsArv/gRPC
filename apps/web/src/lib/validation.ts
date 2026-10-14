export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 20;

const graphemes = new Intl.Segmenter('es', { granularity: 'grapheme' });

/** Validación previa en el cliente (el servidor vuelve a validar). */
export function nicknameError(nickname: string): string | null {
  const length = Array.from(graphemes.segment(nickname.trim())).length;
  if (length < NICKNAME_MIN || length > NICKNAME_MAX) {
    return `El apodo debe tener entre ${NICKNAME_MIN} y ${NICKNAME_MAX} caracteres.`;
  }
  return null;
}
