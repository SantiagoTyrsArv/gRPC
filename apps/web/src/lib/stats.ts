/** Mismas fórmulas que el servidor, para mostrar el WPM propio sin esperar la red. */
export function calculateWpm(correctChars: number, elapsedMs: number): number {
  if (correctChars <= 0 || elapsedMs <= 0) return 0;
  return Math.round((correctChars / 5 / (elapsedMs / 60_000)) * 10) / 10;
}

export function calculateAccuracy(correctChars: number, errors: number): number {
  const total = correctChars + errors;
  return total <= 0 ? 1 : correctChars / total;
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 1000) / 10}%`;
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)} s`;
}
