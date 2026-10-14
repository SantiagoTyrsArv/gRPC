/** Backoff exponencial con jitter: 0,5 s, 1 s, 2 s… hasta `maxMs`. */
export function backoffDelay(
  attempt: number,
  { baseMs = 500, maxMs = 10_000, random = Math.random } = {},
): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** attempt);
  // Jitter de ±20 % para que varios clientes no reconecten a la vez.
  return Math.round(exponential * (0.8 + random() * 0.4));
}
