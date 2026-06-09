import { describe, expect, it } from 'vitest'
import { buildPorts } from '../src/build-ports.js'
import { createMockMidi } from './helpers/mock-midi.js'

describe('buildPorts', () => {
  it('merges input and output that share a name into one port', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Board', manufacturer: 'Kesumo, LLC', type: 'input' },
      { id: 'out-1', name: 'K-Board', manufacturer: 'Kesumo, LLC', type: 'output' },
    ])
    const ports = buildPorts(midi.access, new Map())
    expect(ports.size).toBe(1)
    const port = ports.get('k-board')
    expect(port?.inputID).toBe('in-1')
    expect(port?.outputID).toBe('out-1')
    expect(port?.displayName).toBe('K-Board')
    expect(port?.manufacturer).toBe('kesumo-llc')
  })

  it('includes input-only and output-only ports', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'Only Input', type: 'input' },
      { id: 'out-1', name: 'Only Output', type: 'output' },
    ])
    const ports = buildPorts(midi.access, new Map())
    expect(ports.get('only-input')?.inputID).toBe('in-1')
    expect(ports.get('only-input')?.outputID).toBeUndefined()
    expect(ports.get('only-output')?.outputID).toBe('out-1')
    expect(ports.get('only-output')?.inputID).toBeUndefined()
  })

  it('reuses metadata objects from the store, keyed by name', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const store = new Map<string, Record<string, unknown>>([['k-board', { quality: 'great' }]])
    const ports = buildPorts(midi.access, store)
    expect(ports.get('k-board')?.meta).toEqual({ quality: 'great' })
  })
})
