import { describe, expect, it } from 'vitest'
import { createResolver } from '../src/resolve.js'

describe('createResolver', () => {
  it('defaults to the built-in normalize', () => {
    const resolve = createResolver()
    expect(resolve('MIDIIN2 (Launchkey)')).toBe('launchkey')
  })

  it('maps alias variants to a canonical key', () => {
    const resolve = createResolver({ aliases: { 'k-mix': ['K-Mix Audio', 'K-Mix Ctrl'] } })
    expect(resolve('K-Mix Audio')).toBe('k-mix')
    expect(resolve('K-Mix Ctrl')).toBe('k-mix')
    expect(resolve('Something Else')).toBe('something-else')
  })

  it('uses a custom normalize override instead of the built-in', () => {
    const resolve = createResolver({ normalize: (raw) => raw.trim().toLowerCase() })
    expect(resolve('Launchkey MK3 MIDI 1')).toBe('launchkey mk3 midi 1')
  })
})
