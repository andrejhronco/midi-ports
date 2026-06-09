import { describe, expect, it } from 'vitest'
import { normalize } from '../src/normalize.js'

describe('normalize', () => {
  it('lowercases and hyphenates whitespace', () => {
    expect(normalize('K-Mix Control Surface')).toBe('k-mix-control-surface')
  })

  it('strips commas', () => {
    expect(normalize('Kesumo, LLC')).toBe('kesumo-llc')
  })

  it('collapses runs of whitespace to a single hyphen', () => {
    expect(normalize('Keith   McMillen  Instruments')).toBe('keith-mcmillen-instruments')
  })

  it('trims leading and trailing whitespace', () => {
    expect(normalize('  K-Board  ')).toBe('k-board')
  })

  it('returns an empty string for empty input', () => {
    expect(normalize('')).toBe('')
  })
})
