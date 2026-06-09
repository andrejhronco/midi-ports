/**
 * Normalizes a MIDI port name or manufacturer into a stable map key:
 * lowercased, commas removed, runs of whitespace collapsed to a single hyphen.
 *
 * @example normalize('K-Mix Control Surface') // 'k-mix-control-surface'
 */
export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '-')
}
