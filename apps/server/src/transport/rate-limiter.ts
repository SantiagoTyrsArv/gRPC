export interface TokenBucketOptions {
  /** Ráfaga máxima permitida. */
  capacity: number;
  /** Fichas que se recuperan por segundo. */
  refillPerSecond: number;
  now?: () => number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/** Rate limiter en memoria con el algoritmo token bucket, por clave. */
export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly now: () => number;

  constructor(private readonly options: TokenBucketOptions) {
    this.now = options.now ?? Date.now;
  }

  /** Consume una ficha; devuelve `false` si la clave superó el límite. */
  tryConsume(key: string): boolean {
    const now = this.now();
    const bucket = this.buckets.get(key) ?? { tokens: this.options.capacity, updatedAt: now };
    const elapsedSeconds = (now - bucket.updatedAt) / 1_000;
    bucket.tokens = Math.min(
      this.options.capacity,
      bucket.tokens + elapsedSeconds * this.options.refillPerSecond,
    );
    bucket.updatedAt = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    return allowed;
  }

  /** Elimina cubetas llenas e inactivas para acotar la memoria. */
  prune(): void {
    const fullAfterMs = (this.options.capacity / this.options.refillPerSecond) * 1_000;
    const now = this.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updatedAt > fullAfterMs) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
