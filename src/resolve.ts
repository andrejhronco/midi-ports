import { normalize as builtinNormalize } from './normalize.js'

/** Maps a raw MIDI name to its canonical key. */
export type Normalizer = (raw: string) => string

export interface ResolverOptions {
  /** Replace the built-in normalization rules. */
  normalize?: Normalizer
  /** Map variant names to a canonical key: { canonical: [variant, ...] }. */
  aliases?: Record<string, string[]>
}

/**
 * Builds the effective name resolver: applies the custom-or-built-in normalize,
 * then maps any alias variant to its canonical key.
 */
export function createResolver(options: ResolverOptions = {}): Normalizer {
  const norm = options.normalize ?? builtinNormalize
  const aliasMap = new Map<string, string>()
  for (const [canonical, variants] of Object.entries(options.aliases ?? {})) {
    const canonicalKey = norm(canonical)
    for (const variant of variants) aliasMap.set(norm(variant), canonicalKey)
  }
  return (raw: string) => {
    const key = norm(raw)
    return aliasMap.get(key) ?? key
  }
}
