import { normalize } from './normalize.js'
import { createPort } from './port.js'
import type { Normalizer } from './resolve.js'
import type { Port } from './types.js'

interface Accumulated {
  displayName: string
  manufacturer: string
  inputID?: string
  outputID?: string
}

/**
 * Builds a name-keyed map of ports from an MIDIAccess object, merging an input
 * and output that share a normalized name into a single Port. Metadata records
 * are taken from (and written back into) the provided store so they survive
 * rebuilds/reconnects.
 */
export function buildPorts(
  access: MIDIAccess,
  metaStore: Map<string, Record<string, unknown>>,
  resolve: Normalizer,
  onChange?: () => void,
): Map<string, Port> {
  const accumulated = new Map<string, Accumulated>()

  const collect = (device: MIDIInput | MIDIOutput, kind: 'input' | 'output'): void => {
    const name = resolve(device.name ?? '')
    const entry: Accumulated = accumulated.get(name) ?? {
      displayName: device.name ?? '',
      manufacturer: normalize(device.manufacturer ?? ''),
    }
    if (kind === 'input') entry.inputID = device.id
    else entry.outputID = device.id
    accumulated.set(name, entry)
  }

  for (const input of access.inputs.values()) collect(input, 'input')
  for (const output of access.outputs.values()) collect(output, 'output')

  const ports = new Map<string, Port>()
  for (const [name, entry] of accumulated) {
    const meta = metaStore.get(name) ?? {}
    metaStore.set(name, meta)
    ports.set(
      name,
      createPort({
        name,
        displayName: entry.displayName,
        manufacturer: entry.manufacturer,
        inputID: entry.inputID,
        outputID: entry.outputID,
        access,
        meta,
        onChange,
      }),
    )
  }

  return ports
}
