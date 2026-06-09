/** Thrown when the runtime has no Web MIDI support (navigator.requestMIDIAccess missing). */
export class MidiUnsupportedError extends Error {
  constructor(message = 'Web MIDI API is not supported in this environment') {
    super(message)
    this.name = 'MidiUnsupportedError'
  }
}
