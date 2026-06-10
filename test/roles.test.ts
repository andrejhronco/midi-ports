import { describe, expect, it } from 'vitest'
import { createMidiPorts } from '../src/factory.js'
import { createMockMidi } from './helpers/mock-midi.js'

const roles = { 'drum-out': ['sp-404', 'launchpad'] }

describe('roles', () => {
  it('resolves the first connected candidate in order', () => {
    const midi = createMockMidi([{ id: 'o1', name: 'Launchpad', type: 'output' }])
    const mp = createMidiPorts(midi.access, { roles })
    expect(mp.role('drum-out')?.name).toBe('launchpad')
  })

  it('lists roles with no connected candidate in unresolvedRoles', () => {
    const midi = createMockMidi([])
    const mp = createMidiPorts(midi.access, { roles })
    expect(mp.unresolvedRoles).toEqual(['drum-out'])
  })

  it('prefers a persisted assignment when connected', () => {
    const midi = createMockMidi([
      { id: 'o1', name: 'SP-404', type: 'output' },
      { id: 'o2', name: 'Launchpad', type: 'output' },
    ])
    const mp = createMidiPorts(midi.access, { roles })
    mp.assignRole('drum-out', 'Launchpad')
    expect(mp.role('drum-out')?.name).toBe('launchpad')
    mp.assignRole('drum-out', null)
    expect(mp.role('drum-out')?.name).toBe('sp-404')
  })

  it('throws on an unknown role', () => {
    const midi = createMockMidi([])
    const mp = createMidiPorts(midi.access, { roles })
    expect(() => mp.assignRole('nope', 'x')).toThrow()
  })

  it('persists a role assignment across instances', async () => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const devices = [
      { id: 'o1', name: 'SP-404', type: 'output' as const },
      { id: 'o2', name: 'Launchpad', type: 'output' as const },
    ]

    const mp1 = createMidiPorts(createMockMidi(devices).access, {
      roles,
      persist: { key: 'app:midi', storage },
    })
    mp1.assignRole('drum-out', 'Launchpad')
    await Promise.resolve() // let the coalesced write flush

    const mp2 = createMidiPorts(createMockMidi(devices).access, {
      roles,
      persist: { key: 'app:midi', storage },
    })
    expect(mp2.role('drum-out')?.name).toBe('launchpad')
  })
})
