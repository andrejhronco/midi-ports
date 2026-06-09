import { describe, expect, it } from 'vitest'
import { createPort } from '../src/port.js'
import { createMockMidi } from './helpers/mock-midi.js'

describe('createPort', () => {
  it('exposes identity fields', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const meta = {}
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: 'kesumo-llc',
      inputID: 'in-1',
      access: midi.access,
      meta,
    })
    expect(port.name).toBe('k-board')
    expect(port.displayName).toBe('K-Board')
    expect(port.manufacturer).toBe('kesumo-llc')
    expect(port.inputID).toBe('in-1')
    expect(port.outputID).toBeUndefined()
  })

  it('resolves live input/output and isConnected', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Board', type: 'input' },
      { id: 'out-1', name: 'K-Board', type: 'output' },
    ])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      inputID: 'in-1',
      outputID: 'out-1',
      access: midi.access,
      meta: {},
    })
    expect(port.input?.id).toBe('in-1')
    expect(port.output?.id).toBe('out-1')
    expect(port.isConnected).toBe(true)
  })

  it('send() forwards to the output and is chainable', () => {
    const midi = createMockMidi([{ id: 'out-1', name: 'K-Board', type: 'output' }])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      outputID: 'out-1',
      access: midi.access,
      meta: {},
    })
    expect(port.send([144, 60, 127])).toBe(port)
    expect(midi.sent).toEqual([{ id: 'out-1', data: [144, 60, 127] }])
  })

  it('send() throws when there is no output', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      inputID: 'in-1',
      access: midi.access,
      meta: {},
    })
    expect(() => port.send([144, 60, 127])).toThrow(/no output/i)
  })

  it('set() writes metadata, is chainable, and meta reflects it', () => {
    const midi = createMockMidi()
    const meta: Record<string, unknown> = {}
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      access: midi.access,
      meta,
    })
    expect(port.set('quality', 'great').set('price', 99)).toBe(port)
    expect(port.meta).toEqual({ quality: 'great', price: 99 })
    expect(meta).toEqual({ quality: 'great', price: 99 })
  })
})
