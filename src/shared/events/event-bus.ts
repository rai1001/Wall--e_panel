import { DomainEventType } from "../../types/domain";

export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  type: DomainEventType;
  payload: TPayload;
  occurredAt: string;
}

type EventHandler = (event: DomainEvent) => void | Promise<void>;

export class EventBus {
  private readonly handlers = new Map<DomainEventType, EventHandler[]>();

  subscribe(type: DomainEventType, handler: EventHandler) {
    const current = this.handlers.get(type) ?? [];
    current.push(handler);
    this.handlers.set(type, current);

    return () => {
      const list = this.handlers.get(type) ?? [];
      this.handlers.set(
        type,
        list.filter((candidate) => candidate !== handler)
      );
    };
  }

  async publish(event: DomainEvent) {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}
