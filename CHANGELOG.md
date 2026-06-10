# midi-ports

## 3.0.1

### Patch Changes

- 841ffaa: Docs: add a "Using with webmidi.js" guide that frames midi-ports as the device/port topology layer and webmidi.js as the MIDI messaging layer, with a type-checked example of the two composed. The demo (`demo/index.html`) now shows the same split live — midi-ports lists ports and tracks hot-plug, webmidi.js plays a note and parses incoming messages.

## 3.0.0

### Major Changes

- 13589eb: v3.0.0: complete TypeScript/ESM rewrite. New factory + Port-handle API (`createMidiPorts` / `requestMidiPorts`), grouped devices via a `devices` config, `notFound` tracking, per-port/device metadata that survives reconnects, and hot-plug `connect`/`disconnect`/`statechange` events. The v2 stringly-typed callable API is removed — see the README migration guide.
