import { normalize } from './normalize.js'
import type { Device, Port } from './types.js'

export interface CreateDeviceParams {
  name: string
  ports: Map<string, Port>
  /** Shared metadata record (owned by the factory's per-device store). */
  meta: Record<string, unknown>
}

export function createDevice(params: CreateDeviceParams): Device {
  const { name, ports, meta } = params

  const device: Device = {
    name,
    ports,
    get meta() {
      return meta
    },
    get(portName) {
      return ports.get(normalize(portName))
    },
    set(key, value) {
      meta[key] = value
      return this
    },
  }

  return device
}
