# midi-ports

## 3.2.1

### Patch Changes

- 4327ec8: Docs: highlight the 3.2.0 features (cross-platform names, persistence, roles, `waitFor`, and the `midi-ports/testing` mock) in the README install section. No code changes.

## 3.2.0

### Minor Changes

- 3de1060: Cross-platform name matching, opt-in persistence, named-role resolution, and ergonomic helpers.

  - `normalize()` now strips OS-specific noise (Windows `MIDIIN/MIDIOUT` wrappers and `N-` index prefixes; Linux/ALSA ` MIDI <n>` and `:<n>` suffixes) so input/output halves merge and keys are portable across OSes. **Behavior change:** canonical keys / `port.name` differ for previously-mangled Windows/Linux names. New `aliases` and `normalize` options cover names the heuristics can't reconcile.
  - New `persist` option writes port/device metadata and role assignments through a pluggable `StorageAdapter` (defaults to localStorage), hydrated before the first build.
  - New `roles` config with `role()`, `assignRole()`, and `unresolvedRoles`.
  - New `waitFor(name, options?)` resolving when a port appears (`timeout`/`signal`/`requireBoth`), plus `MidiTimeoutError`.
  - New `midi-ports/testing` entry exporting `createMockMidi` for consumers' tests.

## 3.1.0

### Minor Changes

- c73fbea: `MidiPorts.get(name)` and `Device.get(portName)` now normalize their argument, so the raw device/port name resolves the same as the normalized key — `midi.get('K Board')` works just like `midi.get('k-board')`. Existing normalized lookups are unaffected (normalization is idempotent).

## 3.0.1

### Patch Changes

- 841ffaa: Docs: add a "Using with webmidi.js" guide that frames midi-ports as the device/port topology layer and webmidi.js as the MIDI messaging layer, with a type-checked example of the two composed. The demo (`demo/index.html`) now shows the same split live — midi-ports lists ports and tracks hot-plug, webmidi.js plays a note and parses incoming messages.

## 3.0.0

### Major Changes

- 13589eb: v3.0.0: complete TypeScript/ESM rewrite. New factory + Port-handle API (`createMidiPorts` / `requestMidiPorts`), grouped devices via a `devices` config, `notFound` tracking, per-port/device metadata that survives reconnects, and hot-plug `connect`/`disconnect`/`statechange` events. The v2 stringly-typed callable API is removed — see the README migration guide.
