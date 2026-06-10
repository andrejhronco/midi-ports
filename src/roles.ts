import type { Normalizer } from './resolve.js'
import type { Port } from './types.js'

/**
 * Resolves a role to a Port: a connected persisted assignment wins, else the
 * first connected config candidate in order, else undefined.
 */
export function resolveRole(
  candidates: string[],
  assignment: string | undefined,
  getPort: (canonical: string) => Port | undefined,
  resolve: Normalizer,
): Port | undefined {
  if (assignment) {
    const assigned = getPort(assignment)
    if (assigned?.isConnected) return assigned
  }
  for (const candidate of candidates) {
    const port = getPort(resolve(candidate))
    if (port?.isConnected) return port
  }
  return undefined
}
