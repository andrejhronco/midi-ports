import type { Normalizer } from './resolve.js'
import type { Device, Port } from './types.js'

export interface CreateDeviceParams {
  name: string
  ports: Map<string, Port>
  meta: Record<string, unknown>
  resolve: Normalizer
  onChange?: () => void
}

export function createDevice(params: CreateDeviceParams): Device {
  const { name, ports, meta, resolve, onChange } = params

  const device: Device = {
    name,
    ports,
    get meta() {
      return meta
    },
    get(portName) {
      return ports.get(resolve(portName))
    },
    set(key, value) {
      meta[key] = value
      onChange?.()
      return this
    },
  }

  return device
}
