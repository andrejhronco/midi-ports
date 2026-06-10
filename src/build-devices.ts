import { createDevice } from './device.js'
import type { Normalizer } from './resolve.js'
import type { Device, DevicesConfig, Port } from './types.js'

export interface BuiltDevices {
  devices: Map<string, Device>
  notFound: string[]
}

/**
 * Groups built ports into named devices from a config. Any expected port name
 * not present in `ports` is collected into `notFound`. Device metadata is taken
 * from (and written back into) `deviceMetaStore`, seeded once from config.meta,
 * so user-set metadata survives rebuilds/reconnects.
 */
export function buildDevices(
  config: DevicesConfig,
  ports: ReadonlyMap<string, Port>,
  deviceMetaStore: Map<string, Record<string, unknown>>,
  resolve: Normalizer,
  onChange?: () => void,
): BuiltDevices {
  const devices = new Map<string, Device>()
  // A port name expected by multiple devices should appear once; a Set both
  // dedupes and preserves first-seen order.
  const notFound = new Set<string>()

  for (const [deviceName, deviceConfig] of Object.entries(config)) {
    let meta = deviceMetaStore.get(deviceName)
    if (!meta) {
      meta = { ...(deviceConfig.meta ?? {}) }
      deviceMetaStore.set(deviceName, meta)
    }

    const memberPorts = new Map<string, Port>()
    for (const portName of deviceConfig.ports) {
      const port = ports.get(resolve(portName))
      if (port) memberPorts.set(portName, port)
      else notFound.add(portName)
    }

    devices.set(
      deviceName,
      createDevice({ name: deviceName, ports: memberPorts, meta, resolve, onChange }),
    )
  }

  return { devices, notFound: [...notFound] }
}
