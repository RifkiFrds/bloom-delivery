/**
 * The typed event bus — the ONLY entry point into the machine (Doc 01 §2.2).
 *
 * Detection emits discrete edges; components dispatch user intent. Neither
 * writes state. Keeping this a single narrow door is what makes the event log
 * replayable, which is what makes the machine testable without hardware.
 */

import type { MachineEvent } from '@/machine';

export type EventListener = (event: MachineEvent) => void;

export class EventBus {
  private readonly listeners = new Set<EventListener>();
  private readonly history: MachineEvent[] = [];

  /** Kept for the debug panel: "last 10 events" (Doc 05 P1.9). */
  private static readonly HISTORY_LIMIT = 10;

  emit(event: MachineEvent): void {
    this.history.push(event);
    if (this.history.length > EventBus.HISTORY_LIMIT) this.history.shift();
    for (const listener of this.listeners) listener(event);
  }

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  recent(): readonly MachineEvent[] {
    return [...this.history].reverse();
  }
}

export const bus = new EventBus();
