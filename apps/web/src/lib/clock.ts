/**
 * Estima el desfase entre el reloj del servidor y el del navegador a partir
 * de la hora del servidor que acompaña a cada evento del stream.
 *
 * `serverTime - recibido` subestima el desfase en la latencia de la red, así
 * que la mejor estimación es el máximo observado (la muestra más rápida).
 */
export class ClockSync {
  private offset: number | null = null;

  sample(serverTimeMs: number, receivedAtMs: number): void {
    const candidate = serverTimeMs - receivedAtMs;
    if (this.offset === null || candidate > this.offset) this.offset = candidate;
  }

  /** Desfase en ms (servidor − cliente). 0 si aún no hay muestras. */
  get offsetMs(): number {
    return this.offset ?? 0;
  }

  /** Hora actual expresada en el reloj del servidor. */
  serverNow(clientNowMs: number): number {
    return clientNowMs + this.offsetMs;
  }

  reset(): void {
    this.offset = null;
  }
}
