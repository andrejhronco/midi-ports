import { describe, expect, it } from 'vitest'
import { buildDevices } from '../src/build-devices.js'
import { buildPorts } from '../src/build-ports.js'
import type { DevicesConfig } from '../src/types.js'
import { createMockMidi } from './helpers/mock-midi.js'

const config: DevicesConfig = {
  'k-mix': {
    ports: ['k-mix-audio-control', 'k-mix-control-surface'],
    meta: { icon: 'k-mix.svg' },
  },
  'k-board': { ports: ['k-board'] },
}

describe('buildDevices', () => {
  it('groups connected ports and seeds device metadata from config', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Mix Audio Control', type: 'input' },
      { id: 'in-2', name: 'K-Mix Control Surface', type: 'input' },
      { id: 'in-3', name: 'K-Board', type: 'input' },
    ])
    const ports = buildPorts(midi.access, new Map())
    const { devices, notFound } = buildDevices(config, ports, new Map())

    expect(notFound).toEqual([])
    expect(devices.get('k-mix')?.ports.size).toBe(2)
    expect(devices.get('k-mix')?.get('k-mix-audio-control')?.inputID).toBe('in-1')
    expect(devices.get('k-mix')?.meta).toEqual({ icon: 'k-mix.svg' })
  })

  it('reports expected-but-missing ports in notFound', () => {
    const midi = createMockMidi([{ id: 'in-3', name: 'K-Board', type: 'input' }])
    const ports = buildPorts(midi.access, new Map())
    const { devices, notFound } = buildDevices(config, ports, new Map())

    expect(notFound).toEqual(['k-mix-audio-control', 'k-mix-control-surface'])
    expect(devices.get('k-mix')?.ports.size).toBe(0)
    expect(devices.get('k-board')?.get('k-board')?.inputID).toBe('in-3')
  })

  it('reuses device metadata objects from the store across rebuilds', () => {
    const midi = createMockMidi([{ id: 'in-3', name: 'K-Board', type: 'input' }])
    const ports = buildPorts(midi.access, new Map())
    const store = new Map<string, Record<string, unknown>>()

    const first = buildDevices(config, ports, store)
    first.devices.get('k-board')?.set('label', 'mine')
    const second = buildDevices(config, ports, store)

    expect(second.devices.get('k-board')?.meta).toEqual({ label: 'mine' })
  })

  it('does not duplicate a missing port name shared by multiple devices', () => {
    const shared: DevicesConfig = {
      'dev-a': { ports: ['shared-port'] },
      'dev-b': { ports: ['shared-port'] },
    }
    const midi = createMockMidi()
    const ports = buildPorts(midi.access, new Map())
    const { notFound } = buildDevices(shared, ports, new Map())
    expect(notFound).toEqual(['shared-port'])
  })
})
