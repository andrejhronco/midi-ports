/**
 * Minimal fakes for the Web MIDI API, sufficient for testing midi-ports.
 * Web MIDI global types (MIDIAccess, MIDIInput, ...) come from the TS DOM lib.
 */

export interface PortSpec {
  id: string
  name: string
  manufacturer?: string
  type: 'input' | 'output'
}

export interface MockMidi {
  /** The fake object to pass into createMidiPorts. */
  access: MIDIAccess
  /** Records every output.send([...]) call, in order. */
  sent: Array<{ id: string; data: number[] }>
  /** Adds a port and fires a 'connected' statechange. Returns the fake port. */
  connect(spec: PortSpec): MIDIPort
  /** Removes a port and fires a 'disconnected' statechange. Returns the fake port. */
  disconnect(spec: PortSpec): MIDIPort
}

export function createMockMidi(specs: PortSpec[] = []): MockMidi {
  const inputs = new Map<string, MIDIInput>()
  const outputs = new Map<string, MIDIOutput>()
  const listeners = new Set<(e: MIDIConnectionEvent) => void>()
  const sent: Array<{ id: string; data: number[] }> = []

  function makePort(spec: PortSpec, state: 'connected' | 'disconnected'): MIDIInput | MIDIOutput {
    const base = {
      id: spec.id,
      name: spec.name,
      manufacturer: spec.manufacturer ?? '',
      type: spec.type,
      state,
      connection: 'closed' as MIDIPortConnectionState,
      version: '1',
      onstatechange: null,
      open() {
        return Promise.resolve(this as unknown as MIDIPort)
      },
      close() {
        return Promise.resolve(this as unknown as MIDIPort)
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true
      },
    }
    if (spec.type === 'output') {
      return {
        ...base,
        onmidimessage: null,
        send(data: number[]) {
          sent.push({ id: spec.id, data })
        },
        clear() {},
      } as unknown as MIDIOutput
    }
    return { ...base, onmidimessage: null } as unknown as MIDIInput
  }

  function add(spec: PortSpec): MIDIPort {
    const port = makePort(spec, 'connected')
    if (spec.type === 'input') inputs.set(spec.id, port as MIDIInput)
    else outputs.set(spec.id, port as MIDIOutput)
    return port as unknown as MIDIPort
  }

  for (const spec of specs) add(spec)

  function fire(port: MIDIPort): void {
    const event = { port } as unknown as MIDIConnectionEvent
    for (const handler of listeners) handler(event)
  }

  const access = {
    inputs,
    outputs,
    sysexEnabled: false,
    onstatechange: null,
    addEventListener(type: string, handler: (e: MIDIConnectionEvent) => void) {
      if (type === 'statechange') listeners.add(handler)
    },
    removeEventListener(type: string, handler: (e: MIDIConnectionEvent) => void) {
      if (type === 'statechange') listeners.delete(handler)
    },
    dispatchEvent() {
      return true
    },
  } as unknown as MIDIAccess

  return {
    access,
    sent,
    connect(spec) {
      const port = add(spec)
      fire(port)
      return port
    },
    disconnect(spec) {
      const map = spec.type === 'input' ? inputs : outputs
      const existing = map.get(spec.id)
      map.delete(spec.id)
      const port = (existing as unknown as MIDIPort) ?? makePort(spec, 'disconnected')
      ;(port as { state: MIDIPortDeviceState }).state = 'disconnected'
      fire(port)
      return port
    },
  }
}
