import { describe, expect, it, vi } from 'vitest'
import { MidiUnsupportedError } from '../src/errors.js'
import { createMidiPorts, requestMidiPorts } from '../src/factory.js'
import type { DevicesConfig } from '../src/types.js'
import { createMockMidi } from './helpers/mock-midi.js'

const config: DevicesConfig = {
  'k-mix': { ports: ['k-mix-audio-control', 'k-mix-control-surface'] },
}

describe('createMidiPorts', () => {
  it('exposes ports, get(), and access', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    expect(mp.access).toBe(midi.access)
    expect(mp.get('k-board')?.inputID).toBe('in-1')
    expect(mp.ports.size).toBe(1)
  })

  it('builds devices and notFound from config', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Mix Audio Control', type: 'input' }])
    const mp = createMidiPorts(midi.access, { devices: config })
    expect(mp.device('k-mix')?.get('k-mix-audio-control')?.inputID).toBe('in-1')
    expect(mp.notFound).toEqual(['k-mix-control-surface'])
  })

  it('emits connect and updates ports/notFound on hot-plug', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Mix Audio Control', type: 'input' }])
    const mp = createMidiPorts(midi.access, { devices: config })
    const onConnect = vi.fn()
    const onState = vi.fn()
    mp.on('connect', onConnect)
    mp.on('statechange', onState)

    midi.connect({ id: 'in-2', name: 'K-Mix Control Surface', type: 'input' })

    expect(mp.get('k-mix-control-surface')?.inputID).toBe('in-2')
    expect(mp.notFound).toEqual([])
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect.mock.calls[0]![0]!.type).toBe('connect')
    expect(onConnect.mock.calls[0]![0]!.port.name).toBe('k-mix-control-surface')
    expect(onState).toHaveBeenCalledTimes(1)
  })

  it('emits disconnect and removes the port on unplug', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    const onDisconnect = vi.fn()
    mp.on('disconnect', onDisconnect)

    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(mp.get('k-board')).toBeUndefined()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(onDisconnect.mock.calls[0]![0]!.port.name).toBe('k-board')
  })

  it('preserves custom metadata across a disconnect/reconnect', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    mp.get('k-board')?.set('quality', 'great')

    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })
    midi.connect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(mp.get('k-board')?.meta).toEqual({ quality: 'great' })
  })

  it('dispose() detaches the listener so no further events fire', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    const onState = vi.fn()
    mp.on('statechange', onState)

    mp.dispose()
    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(onState).not.toHaveBeenCalled()
  })
})

describe('requestMidiPorts', () => {
  it('throws MidiUnsupportedError when Web MIDI is unavailable', async () => {
    const original = globalThis.navigator
    // @ts-expect-error — simulate an environment without requestMIDIAccess
    globalThis.navigator = {}
    await expect(requestMidiPorts()).rejects.toBeInstanceOf(MidiUnsupportedError)
    globalThis.navigator = original
  })

  it('wraps the access returned by navigator.requestMIDIAccess', async () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const original = globalThis.navigator
    // @ts-expect-error — inject a fake navigator
    globalThis.navigator = { requestMIDIAccess: vi.fn().mockResolvedValue(midi.access) }

    const mp = await requestMidiPorts({ sysex: true })
    expect(mp.get('k-board')?.inputID).toBe('in-1')

    globalThis.navigator = original
  })
})
