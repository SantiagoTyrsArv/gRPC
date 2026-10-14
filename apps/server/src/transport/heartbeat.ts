/**
 * Intercala un latido cada `intervalMs` sin eventos en un iterable asíncrono.
 * Mantiene vivas las conexiones de streaming a través de proxies (Render)
 * que cierran conexiones inactivas.
 */
export async function* withHeartbeat<T>(
  source: AsyncIterable<T>,
  intervalMs: number,
  heartbeat: () => T,
): AsyncGenerator<T> {
  const iterator = source[Symbol.asyncIterator]();
  let pending: Promise<IteratorResult<T>> | null = null;
  try {
    for (;;) {
      pending ??= iterator.next();
      let timer: NodeJS.Timeout | undefined;
      const tick = new Promise<'tick'>((resolve) => {
        timer = setTimeout(() => {
          resolve('tick');
        }, intervalMs);
      });
      const result = await Promise.race([pending, tick]);
      clearTimeout(timer);

      if (result === 'tick') {
        yield heartbeat();
        continue;
      }
      pending = null;
      if (result.done) return;
      yield result.value;
    }
  } finally {
    // Sin `await`: si hay un `next()` pendiente, `return()` quedaría en cola tras él.
    void iterator.return?.();
  }
}
