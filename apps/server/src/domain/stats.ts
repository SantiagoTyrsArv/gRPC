/** Convención estándar: una "palabra" equivale a 5 caracteres. */
export const CHARS_PER_WORD = 5;

const MS_PER_MINUTE = 60_000;

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** WPM = (caracteres correctos / 5) / minutos transcurridos. Redondeado a 1 decimal. */
export function calculateWpm(correctChars: number, elapsedMs: number): number {
  if (correctChars <= 0 || elapsedMs <= 0) return 0;
  return roundTo(correctChars / CHARS_PER_WORD / (elapsedMs / MS_PER_MINUTE), 1);
}

/** Precisión = correctos / (correctos + errores), entre 0 y 1. Sin pulsaciones es 1. */
export function calculateAccuracy(correctChars: number, errors: number): number {
  const total = correctChars + errors;
  if (total <= 0) return 1;
  return roundTo(correctChars / total, 4);
}

/** Porcentaje de avance (0–100) con 1 decimal. */
export function calculatePercent(correctChars: number, textLength: number): number {
  if (textLength <= 0 || correctChars <= 0) return 0;
  return roundTo(Math.min(100, (correctChars / textLength) * 100), 1);
}
