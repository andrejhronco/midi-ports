---
'midi-ports': minor
---

Cross-platform name matching, opt-in persistence, named-role resolution, and ergonomic helpers.

- `normalize()` now strips OS-specific noise (Windows `MIDIIN/MIDIOUT` wrappers and `N-` index prefixes; Linux/ALSA ` MIDI <n>` and `:<n>` suffixes) so input/output halves merge and keys are portable across OSes. **Behavior change:** canonical keys / `port.name` differ for previously-mangled Windows/Linux names. New `aliases` and `normalize` options cover names the heuristics can't reconcile.
- New `persist` option writes port/device metadata and role assignments through a pluggable `StorageAdapter` (defaults to localStorage), hydrated before the first build.
- New `roles` config with `role()`, `assignRole()`, and `unresolvedRoles`.
- New `waitFor(name, options?)` resolving when a port appears (`timeout`/`signal`/`requireBoth`), plus `MidiTimeoutError`.
- New `midi-ports/testing` entry exporting `createMockMidi` for consumers' tests.
