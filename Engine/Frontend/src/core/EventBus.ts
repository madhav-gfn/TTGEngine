import type { EventPayload, EventType } from "./types";

type Handler<T> = (payload: T) => void;
type HandlerMap = {
  [K in EventType]: Set<Handler<EventPayload[K]>>;
};

export class EventBus {
  private handlers = new Map<EventType, Set<Handler<unknown>>>();

  emit<T extends EventType>(type: T, payload: EventPayload[T]): void {
    const listeners = this.handlers.get(type);
    if (!listeners) {
      return;
    }

    listeners.forEach((listener) => {
      (listener as Handler<EventPayload[T]>)(payload);
    });
  }

  on<T extends EventType>(type: T, handler: Handler<EventPayload[T]>): () => void {
    const listeners = this.handlers.get(type) ?? new Set<Handler<unknown>>();
    listeners.add(handler as Handler<unknown>);
    this.handlers.set(type, listeners);
    return () => this.off(type, handler);
  }

  once<T extends EventType>(type: T, handler: Handler<EventPayload[T]>): () => void {
    const unsubscribe = this.on(type, (payload) => {
      unsubscribe();
      handler(payload);
    });

    return unsubscribe;
  }

  off<T extends EventType>(type: T, handler: Handler<EventPayload[T]>): void {
    const listeners = this.handlers.get(type);
    if (!listeners) {
      return;
    }

    listeners.delete(handler as Handler<unknown>);
    if (listeners.size === 0) {
      this.handlers.delete(type);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
export type { HandlerMap };
