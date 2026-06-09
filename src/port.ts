import type { Port } from './types.js'

export interface CreatePortParams {
  name: string
  displayName: string
  manufacturer: string
  inputID?: string
  outputID?: string
  access: MIDIAccess
  /** Shared metadata record (owned by the factory's per-name store). */
  meta: Record<string, unknown>
}

export function createPort(params: CreatePortParams): Port {
  const { name, displayName, manufacturer, inputID, outputID, access, meta } = params

  const port: Port = {
    name,
    displayName,
    manufacturer,
    inputID,
    outputID,
    get input() {
      return inputID ? access.inputs.get(inputID) : undefined
    },
    get output() {
      return outputID ? access.outputs.get(outputID) : undefined
    },
    get isConnected() {
      return Boolean(this.input || this.output)
    },
    get meta() {
      return meta
    },
    send(data, timestamp) {
      const output = this.output
      if (!output) {
        throw new Error(`Port '${name}' has no output to send on`)
      }
      output.send(data, timestamp)
      return this
    },
    set(key, value) {
      meta[key] = value
      return this
    },
  }

  return port
}
