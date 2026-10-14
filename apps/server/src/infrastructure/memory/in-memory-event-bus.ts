import type { RoomEvent } from '../../application/events.js';
import type { RoomEventBus } from '../../application/ports/room-event-bus.js';

/** Eventos pendientes máximos por suscriptor antes de cortarlo (cliente lento). */
const DEFAULT_MAX_QUEUE = 1_000;

/**
 * Cola asíncrona de un suscriptor: `push` encola o entrega directamente al
 * consumidor que espera; `close` finaliza la iteración.
 */
class Subscription implements AsyncIterableIterator<RoomEvent> {
  private readonly queue: RoomEvent[] = [];
  private waiting: ((result: IteratorResult<RoomEvent>) => void) | null = null;
  private closed = false;

  constructor(
    private readonly maxQueue: number,
    private readonly onClose: () => void,
  ) {}

  push(event: RoomEvent): void {
    if (this.closed) return;
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: event, done: false });
      return;
    }
    if (this.queue.length >= this.maxQueue) {
      // Cliente demasiado lento: se corta; al reconectar recibirá un snapshot.
      this.close();
      return;
    }
    this.queue.push(event);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.queue.length = 0;
    this.onClose();
    if (this.waiting) {
      const resolve = this.waiting;
      this.waiting = null;
      resolve({ value: undefined, done: true });
    }
  }

  next(): Promise<IteratorResult<RoomEvent>> {
    const event = this.queue.shift();
    if (event) return Promise.resolve({ value: event, done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => {
      this.waiting = resolve;
    });
  }

  return(): Promise<IteratorResult<RoomEvent>> {
    this.close();
    return Promise.resolve({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<RoomEvent> {
    return this;
  }
}

/** Pub/Sub en memoria por sala (un solo proceso). */
export class InMemoryRoomEventBus implements RoomEventBus {
  private readonly subscribers = new Map<string, Set<Subscription>>();

  constructor(private readonly maxQueue = DEFAULT_MAX_QUEUE) {}

  publish(roomCode: string, event: RoomEvent): void {
    for (const subscription of this.subscribers.get(roomCode) ?? []) subscription.push(event);
  }

  subscribe(roomCode: string, signal: AbortSignal): AsyncIterable<RoomEvent> {
    let set = this.subscribers.get(roomCode);
    if (!set) {
      set = new Set();
      this.subscribers.set(roomCode, set);
    }
    const subscription = new Subscription(this.maxQueue, () => {
      set.delete(subscription);
      if (set.size === 0 && this.subscribers.get(roomCode) === set) {
        this.subscribers.delete(roomCode);
      }
      signal.removeEventListener('abort', onAbort);
    });
    const onAbort = (): void => {
      subscription.close();
    };
    set.add(subscription);

    if (signal.aborted) subscription.close();
    else signal.addEventListener('abort', onAbort, { once: true });
    return subscription;
  }

  closeRoom(roomCode: string): void {
    for (const subscription of [...(this.subscribers.get(roomCode) ?? [])]) subscription.close();
    this.subscribers.delete(roomCode);
  }

  /** Número de suscriptores activos (útil para tests y métricas). */
  subscriberCount(roomCode: string): number {
    return this.subscribers.get(roomCode)?.size ?? 0;
  }
}
