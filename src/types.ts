import type { WaitOptions } from './wait.js'

export type { WaitOptions } from './wait.js'

/** Options accepted by createMidiPorts / requestMidiPorts. */
export interface MidiPortsOptions {
  /** Request SysEx permission. Only used by requestMidiPorts. */
  sysex?: boolean
  /** Request software-synth access. Only used by requestMidiPorts. */
  software?: boolean
  /** Optional grouping of ports into named devices. */
  devices?: DevicesConfig
  /** Map variant device names to a canonical key. */
  aliases?: Record<string, string[]>
  /** Replace the built-in name normalization. */
  normalize?: (raw: string) => string
}

/** Configuration describing how to group ports into named devices. */
export interface DevicesConfig {
  [deviceName: string]: {
    /** Expected normalized port names that belong to this device. */
    ports: string[]
    /** Optional device-level metadata (icon, manufacturer, etc.). */
    meta?: Record<string, unknown>
  }
}

/** A single MIDI port, keyed by its normalized name, with live input/output access. */
export interface Port {
  /** Normalized key, e.g. 'k-mix-control-surface'. */
  readonly name: string
  /** Original device name, e.g. 'K-Mix Control Surface'. */
  readonly displayName: string
  /** Normalized manufacturer string. */
  readonly manufacturer: string
  /** Underlying MIDIInput id, if this port has an input. */
  readonly inputID?: string
  /** Underlying MIDIOutput id, if this port has an output. */
  readonly outputID?: string
  /** Live MIDIInput resolved against MIDIAccess, or undefined. */
  readonly input?: MIDIInput
  /** Live MIDIOutput resolved against MIDIAccess, or undefined. */
  readonly output?: MIDIOutput
  /** True when an input or output currently resolves. */
  readonly isConnected: boolean
  /** Read-only view of this port's custom metadata. */
  readonly meta: Readonly<Record<string, unknown>>
  /** Send a MIDI message via this port's output. Throws if there is no output. Chainable. */
  send(data: number[] | Uint8Array, timestamp?: number): this
  /** Attach arbitrary metadata to this port. Chainable. Survives reconnects. */
  set(key: string, value: unknown): this
}

/** A named group of ports plus device-level metadata. */
export interface Device {
  readonly name: string
  readonly ports: ReadonlyMap<string, Port>
  /** Read-only view of this device's metadata. */
  readonly meta: Readonly<Record<string, unknown>>
  /** Look up a member port by its normalized name. */
  get(portName: string): Port | undefined
  /** Attach arbitrary metadata to this device. Chainable. */
  set(key: string, value: unknown): this
}

export type MidiPortEventType = 'connect' | 'disconnect' | 'statechange'

/** Payload delivered to event subscribers. */
export interface MidiPortEvent {
  /**
   * What happened to the affected port:
   * - 'connect': the port newly appeared
   * - 'disconnect': the port fully went away
   * - 'change': the port is still present but its input/output set changed
   *   (e.g. an input-only port gained an output). Only delivered on the
   *   'statechange' channel.
   */
  type: 'connect' | 'disconnect' | 'change'
  /** The affected Port handle. */
  port: Port
  /** The raw browser connection event. */
  raw: MIDIConnectionEvent
}

/** The object returned by createMidiPorts / requestMidiPorts. */
export interface MidiPorts {
  readonly access: MIDIAccess
  /** All currently-connected ports, keyed by normalized name. */
  readonly ports: ReadonlyMap<string, Port>
  /** Grouped devices (empty unless a devices config was provided). */
  readonly devices: ReadonlyMap<string, Device>
  /** Expected port names (from config) not currently connected. */
  readonly notFound: string[]
  /** Look up a port by its normalized name. */
  get(name: string): Port | undefined
  /** Look up a grouped device by name. */
  device(name: string): Device | undefined
  /** Resolve once a port (by raw or canonical name) is present. */
  waitFor(name: string, options?: WaitOptions): Promise<Port>
  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: MidiPortEventType, handler: (event: MidiPortEvent) => void): () => void
  /** Remove a previously-registered handler. */
  off(event: MidiPortEventType, handler: (event: MidiPortEvent) => void): void
  /** Detach the statechange listener and clear all subscribers. */
  dispose(): void
}
