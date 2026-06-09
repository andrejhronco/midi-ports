import { describe, expect, it, vi } from 'vitest'
import { createEmitter } from '../src/events.js'

describe('createEmitter', () => {
  it('calls handlers registered for an event and returns an unsubscribe fn', () => {
    const emitter = createEmitter()
    const handler = vi.fn()
    const unsubscribe = emitter.on('connect', handler)

    emitter.emit('connect', { type: 'connect' } as never)
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    emitter.emit('connect', { type: 'connect' } as never)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('off() removes a handler and clear() removes all', () => {
    const emitter = createEmitter()
    const a = vi.fn()
    const b = vi.fn()
    emitter.on('statechange', a)
    emitter.on('statechange', b)

    emitter.off('statechange', a)
    emitter.emit('statechange', {} as never)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)

    emitter.clear()
    emitter.emit('statechange', {} as never)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
