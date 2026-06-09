import { buildDevices } from './build-devices.js'
import { buildPorts } from './build-ports.js'
import { MidiUnsupportedError } from './errors.js'
import { createEmitter } from './events.js'
import { normalize } from './normalize.js'
import type { Device, MidiPorts, MidiPortsOptions, Port } from './types.js'

/** Wraps an existing MIDIAccess object. */
export function createMidiPorts(access: MIDIAccess, options: MidiPortsOptions = {}): MidiPorts {
  const config = options.devices ?? {}
  const metaStore = new Map<string, Record<string, unknown>>()
  const deviceMetaStore = new Map<string, Record<string, unknown>>()
  const emitter = createEmitter()

  let ports: Map<string, Port> = buildPorts(access, metaStore)
  let devices: Map<string, Device>
  let notFound: string[]

  const rebuild = (): void => {
    ports = buildPorts(access, metaStore)
    const built = buildDevices(config, ports, deviceMetaStore)
    devices = built.devices
    notFound = built.notFound
  }

  const initial = buildDevices(config, ports, deviceMetaStore)
  devices = initial.devices
  notFound = initial.notFound

  const handleStateChange = (raw: MIDIConnectionEvent): void => {
    const changed = raw.port
    if (!changed) return
    const name = normalize(changed.name ?? '')

    const previous = ports.get(name)
    rebuild()
    const current = ports.get(name)

    if (!previous && current) {
      emitter.emit('connect', { type: 'connect', port: current, raw })
    } else if (previous && !current) {
      emitter.emit('disconnect', { type: 'disconnect', port: previous, raw })
    }

    const isConnected = changed.state === 'connected'
    const port = current ?? previous
    if (port) {
      emitter.emit('statechange', {
        type: isConnected ? 'connect' : 'disconnect',
        port,
        raw,
      })
    }
  }

  access.addEventListener('statechange', handleStateChange)

  return {
    access,
    get ports() {
      return ports
    },
    get devices() {
      return devices
    },
    get notFound() {
      return notFound
    },
    get(name) {
      return ports.get(name)
    },
    device(name) {
      return devices.get(name)
    },
    on(event, handler) {
      return emitter.on(event, handler)
    },
    off(event, handler) {
      emitter.off(event, handler)
    },
    dispose() {
      access.removeEventListener('statechange', handleStateChange)
      emitter.clear()
    },
  }
}

/** Requests Web MIDI access, then wraps it. */
export async function requestMidiPorts(options: MidiPortsOptions = {}): Promise<MidiPorts> {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    throw new MidiUnsupportedError()
  }
  const access = await navigator.requestMIDIAccess({
    sysex: options.sysex,
    software: options.software,
  })
  return createMidiPorts(access, options)
}
