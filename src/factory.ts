import { buildDevices } from './build-devices.js'
import { buildPorts } from './build-ports.js'
import { MidiUnsupportedError } from './errors.js'
import { createEmitter } from './events.js'
import { createResolver } from './resolve.js'
import type { Device, MidiPortEvent, MidiPorts, MidiPortsOptions, Port } from './types.js'

/** Wraps an existing MIDIAccess object. */
export function createMidiPorts(access: MIDIAccess, options: MidiPortsOptions = {}): MidiPorts {
  const config = options.devices ?? {}
  // Metadata is keyed by normalized name and intentionally retained across
  // disconnects so it survives reconnects. The key space is bounded by the
  // device names the user actually owns, so this does not grow without bound.
  const metaStore = new Map<string, Record<string, unknown>>()
  const deviceMetaStore = new Map<string, Record<string, unknown>>()
  const emitter = createEmitter()
  const resolve = createResolver({ normalize: options.normalize, aliases: options.aliases })

  // onChange (write-through persistence) is wired in a later task; omitted here.
  let ports: Map<string, Port> = buildPorts(access, metaStore, resolve)
  let devices: Map<string, Device>
  let notFound: string[]

  const rebuild = (): void => {
    ports = buildPorts(access, metaStore, resolve)
    const built = buildDevices(config, ports, deviceMetaStore, resolve)
    devices = built.devices
    notFound = built.notFound
  }

  const initial = buildDevices(config, ports, deviceMetaStore, resolve)
  devices = initial.devices
  notFound = initial.notFound

  const handleStateChange = (raw: MIDIConnectionEvent): void => {
    const changed = raw.port
    if (!changed) return
    const name = resolve(changed.name ?? '')

    const previous = ports.get(name)
    rebuild()
    const current = ports.get(name)

    // Derive the event from the port's presence transition, not from the
    // single changed half's state — a merged input+output port can gain or
    // lose one half while remaining present.
    let type: 'connect' | 'disconnect' | 'change'
    if (!previous && current) type = 'connect'
    else if (previous && !current) type = 'disconnect'
    else if (current) type = 'change'
    else return // absent -> absent: nothing meaningful happened

    const port = current ?? previous
    if (!port) return
    const event: MidiPortEvent = { type, port, raw }

    if (type === 'connect') emitter.emit('connect', event)
    else if (type === 'disconnect') emitter.emit('disconnect', event)
    emitter.emit('statechange', event)
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
      return ports.get(resolve(name))
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
