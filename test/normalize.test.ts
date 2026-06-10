import { describe, expect, it } from 'vitest'
import { normalize } from '../src/normalize.js'

describe('normalize', () => {
  it('keeps the existing rules (lowercase, drop commas, spaces to hyphens)', () => {
    expect(normalize('K-Mix Control Surface')).toBe('k-mix-control-surface')
    expect(normalize('Roland, Inc TR8')).toBe('roland-inc-tr8')
  })

  it('strips the Windows MIDIIN/MIDIOUT direction wrapper so halves merge', () => {
    expect(normalize('MIDIIN2 (Launchkey)')).toBe('launchkey')
    expect(normalize('MIDIOUT2 (Launchkey)')).toBe('launchkey')
  })

  it('strips a leading Windows enumeration index', () => {
    expect(normalize('2- Launchkey MK3')).toBe('launchkey-mk3')
  })

  it('strips a trailing Linux/ALSA port designator', () => {
    expect(normalize('Launchkey MK3 MIDI 1')).toBe('launchkey-mk3')
    expect(normalize('USB MIDI Device:0')).toBe('usb-midi-device')
  })

  it('is idempotent on already-canonical keys', () => {
    expect(normalize('launchkey-mk3')).toBe('launchkey-mk3')
  })
})
