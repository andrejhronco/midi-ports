import { describe, expect, it } from 'vitest'
import { createDevice } from '../src/device.js'
import { createPort } from '../src/port.js'
import { createResolver } from '../src/resolve.js'
import { createMockMidi } from './helpers/mock-midi.js'

const resolve = createResolver()

function samplePort(name: string) {
  const midi = createMockMidi()
  return createPort({
    name,
    displayName: name,
    manufacturer: '',
    access: midi.access,
    meta: {},
  })
}

describe('createDevice', () => {
  it('looks up member ports by name', () => {
    const port = samplePort('k-board')
    const device = createDevice({
      name: 'k-board',
      ports: new Map([['k-board', port]]),
      meta: {},
      resolve,
    })
    expect(device.name).toBe('k-board')
    expect(device.get('k-board')).toBe(port)
    expect(device.get('missing')).toBeUndefined()
    expect(device.ports.size).toBe(1)
  })

  it('set() writes device metadata, is chainable, and survives via the shared store', () => {
    const meta: Record<string, unknown> = { icon: 'k.svg' }
    const device = createDevice({ name: 'k-mix', ports: new Map(), meta, resolve })
    expect(device.set('label', 'My Mixer')).toBe(device)
    expect(device.meta).toEqual({ icon: 'k.svg', label: 'My Mixer' })
    expect(meta).toEqual({ icon: 'k.svg', label: 'My Mixer' })
  })
})
