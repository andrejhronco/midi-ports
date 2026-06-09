import type { MidiPortEvent, MidiPortEventType } from './types.js'

type Handler = (event: MidiPortEvent) => void

export interface Emitter {
  on(type: MidiPortEventType, handler: Handler): () => void
  off(type: MidiPortEventType, handler: Handler): void
  emit(type: MidiPortEventType, event: MidiPortEvent): void
  clear(): void
}

export function createEmitter(): Emitter {
  const handlers = new Map<MidiPortEventType, Set<Handler>>()

  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set<Handler>()
      set.add(handler)
      handlers.set(type, set)
      return () => this.off(type, handler)
    },
    off(type, handler) {
      handlers.get(type)?.delete(handler)
    },
    emit(type, event) {
      const set = handlers.get(type)
      if (!set) return
      for (const handler of set) handler(event)
    },
    clear() {
      handlers.clear()
    },
  }
}
