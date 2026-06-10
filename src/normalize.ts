/**
 * Normalizes a MIDI port name or manufacturer into a stable map key:
 * strips OS-specific noise, then lowercases, removes commas, and collapses
 * runs of whitespace to a single hyphen.
 *
 * @example normalize('K-Mix Control Surface') // 'k-mix-control-surface'
 * @example normalize('MIDIIN2 (Launchkey)')   // 'launchkey'
 */
export function normalize(value: string): string {
  return stripOsNoise(value).trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '-')
}

/**
 * Removes OS-specific decorations that would otherwise break the input/output
 * merge or cross-OS lookup. Heuristic and best-effort; consumers with
 * duplicate-name or multi-port rigs can override `normalize` via options.
 */
function stripOsNoise(value: string): string {
  let v = value.trim()
  // Windows: unwrap the direction marker, e.g. 'MIDIIN2 (Name)' -> 'Name'.
  const unwrapped = v.match(/^MIDI(?:IN|OUT)\d*\s*\((.+)\)$/i)?.[1]
  if (unwrapped) v = unwrapped
  // Windows: strip a leading enumeration index, e.g. '2- Name' -> 'Name'.
  v = v.replace(/^\d+-\s*/, '')
  // Linux/ALSA: strip a trailing port designator, e.g. 'Name MIDI 1' -> 'Name'.
  v = v.replace(/\s+MIDI\s+\d+$/i, '')
  // Linux/ALSA: strip a trailing client:port suffix, e.g. 'Name:0' -> 'Name'.
  v = v.replace(/:\d+$/, '')
  return v
}
