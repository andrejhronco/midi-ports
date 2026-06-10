# midi-ports 3.2.0 — Topology Hardening

- **Date:** 2026-06-10
- **Status:** Approved (pending spec review)
- **Target release:** 3.2.0 (minor)

## Context

`midi-ports` is the device/port **topology** layer for Web MIDI: it resolves
ports by name, merges an input/output pair into one `Port`, groups ports into
devices, tracks `notFound`, retains metadata across reconnects, and emits
hot-plug events. Messaging (notes/CC/parsing) is intentionally out of scope and
left to webmidi.js.

This release hardens that topology layer along four axes the maintainer
prioritized: cross-platform name robustness, persistence of metadata across page
reloads, a named-role resolution system, and ergonomic helpers. None of these
add messaging features or external runtime dependencies.

## Goals

1. Make name-based lookup and the input/output merge work across macOS, Windows,
   and Linux, where the OS mangles MIDI port names.
2. Let metadata (and role assignments) survive a page reload, not just a
   reconnect within a session.
3. Provide a declarative way to bind logical roles to candidate ports, resolve
   the first connected one, persist a user override, and surface unresolved
   roles.
4. Add small ergonomic helpers: awaiting a device, and a shippable test mock.

## Non-goals

- MIDI messaging (notes, CC, clock, parsing) — webmidi.js's job.
- Asynchronous storage backends (IndexedDB, remote) — synchronous adapter only.
- Fuzzy/substring name matching by default (false-match risk).
- Changing the existing public API in a breaking way.

## Semver

All additions are backward-compatible (new optional options, new methods), so
this ships as a **minor** (3.2.0). The one behavior change is that `normalize()`
now strips OS-specific noise, so the canonical key / `port.name` changes for
Windows- and Linux-mangled names. This only alters previously-broken behavior
(those keys did not merge or match portably before). The changeset MUST call
this out prominently.

---

## Feature 1 — Cross-platform name matching

### The tension

OS index/port markers exist for **disambiguation**. Stripping them fixes the
common single-device case but risks a **false merge** — collapsing genuinely
distinct ports into one. Concrete risks:

- A multi-port interface exposing `Device MIDI 1` and `Device MIDI 2` (Linux).
- Two identically-named controllers shown as `2- Foo` / `3- Foo` (Windows).

A false merge is a correctness bug (data loss), not just a missed lookup. The
design therefore pairs sensible default stripping with explicit escape hatches.

### Three layers

1. **Default heuristics** in `normalize()`, applied to the raw name
   (case-insensitively) **before** the existing lowercase / comma-drop /
   whitespace-to-hyphen rules:
   - **macOS:** typically already clean — no dedicated rule.
   - **Windows:** unwrap the direction marker `MIDIIN<n> (X)` / `MIDIOUT<n> (X)`
     → `X` (this is what merges the input and output halves). Strip a leading
     enumeration index `^\d+-\s*`.
   - **Linux/ALSA:** strip a trailing port designator ` MIDI <n>` and a trailing
     `:<n>`.
   - Order: structural strips (above) first, then the existing
     `trim().toLowerCase().replace(/,/g, '').replace(/\s+/g, '-')`.

2. **`aliases` config** — explicitly map variant names to a canonical key, for
   names the heuristics cannot reconcile (e.g. genuinely different input vs
   output names for the same device):

   ```ts
   createMidiPorts(access, {
     aliases: { 'k-mix': ['k-mix audio', 'k-mix ctrl'] },
   })
   ```

   Each listed variant is itself normalized, then mapped to the canonical key.
   Aliases feed **both** lookup and the input/output merge in `buildPorts`.

3. **`normalize` override hook** — replace the built-in rules entirely:

   ```ts
   createMidiPorts(access, { normalize: (raw: string) => string })
   ```

   Used when a platform/device defeats the heuristics, or to write **more
   conservative** rules that deliberately avoid a false merge (e.g. keep the
   ` MIDI <n>` index so multi-port devices stay separate).

### Resolution precedence

When resolving a raw device name to a canonical key:
1. Apply the effective `normalize` (custom override if provided, else built-in).
2. Apply `aliases` (variant → canonical) to the normalized result.

The same effective normalization is used for: building/merging ports, `get()`
lookup, alias keys, role candidates, and `waitFor` names — so behavior is
consistent everywhere.

### Caveats (documented)

- Defaults optimize for the common single-device case. Duplicate-name or
  multi-port rigs should use the `normalize` override and/or `aliases`.
- `displayName` remains the raw OS string of whichever half is collected first;
  on Windows/Linux the two halves' raw names may differ.
- The exact Windows/Linux regexes will be **validated against real hardware**
  during implementation; `normalize.ts` stays a pure function so the patterns
  are table-testable.

---

## Feature 2 — Persistence

Opt-in write-through persistence of metadata and role assignments.

```ts
createMidiPorts(access, {
  persist: { key: 'my-app:midi', storage?: StorageAdapter },
})
```

- **`StorageAdapter`** (new exported type):
  ```ts
  interface StorageAdapter {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
  }
  ```
  Defaults to `localStorage`. Synchronous only (matches `localStorage`). The
  adapter makes the feature SSR-safe (inject a no-op or in-memory store) and
  testable (inject a mock).

- **What is stored** — a single JSON document under `key`:
  - port `meta`, keyed by canonical name
  - device `meta`, keyed by device name
  - role assignments (`{ [role]: canonicalName }`)

  Not stored: live `ports`, `devices`, `notFound`, or the config itself.

- **Lifecycle:**
  - On init, read and parse the stored document and hydrate the metadata stores
    and role-assignment map **before** the first `buildPorts`, so reconnecting
    devices immediately carry their saved metadata.
  - Write-through on every `set()` (port and device) and `assignRole()`, coalesced
    via a microtask so a burst of `set()` calls produces one write.

- **Safety:** all storage access is wrapped in try/catch. A full quota,
  unavailable store (private mode), or parse error degrades to in-memory and
  never throws. Omitting `persist` preserves today's exact behavior.

---

## Feature 3 — Named-role resolution

```ts
const midi = createMidiPorts(access, {
  roles: { 'drum-out': ['sp-404', 'launchpad'], 'lead-in': ['keystep'] },
})

midi.role('drum-out')                     // resolved Port | undefined
midi.assignRole('drum-out', 'launchpad')  // user override; persisted
midi.assignRole('drum-out', null)         // clear back to candidate fallback
midi.unresolvedRoles                       // string[] — roles with no connected candidate
```

- **Config:** `roles` is `{ [roleName: string]: string[] }` — an ordered list of
  candidate port names (each alias/normalize-aware).
- **Resolution order** for `role(name)`:
  1. persisted assignment for the role, if that port is currently connected
  2. config candidates, in order, first connected wins
  3. `undefined`
- **`assignRole(name, portName)`:** sets a user override. Throws on an unknown
  role name (a programming error). `portName` is normalized/alias-resolved before
  storing. Passing `null`/`undefined` clears the override. Writes through
  persistence when `persist` is enabled.
- **`unresolvedRoles`:** roles for which `role()` returns `undefined`.
- **Reactivity:** `role()` and `unresolvedRoles` resolve **on demand** against the
  live `ports` map — always fresh, no extra rebuild bookkeeping.

---

## Feature 4 — Ergonomic wins

### `waitFor`

```ts
const port = await midi.waitFor('k-board', {
  timeout?: number,        // ms; rejects with MidiTimeoutError
  signal?: AbortSignal,    // rejects with the abort reason
  requireBoth?: boolean,   // require input AND output (default: either half)
})
```

- Resolves **immediately** if the named port is already present; otherwise on the
  next `connect`/`change` that satisfies the condition. Alias/normalize-aware.
- Default condition: port present (`isConnected`, i.e. either half). With
  `requireBoth: true`, waits until both `input` and `output` exist.
- `timeout` rejects with a new exported `MidiTimeoutError`. `signal` rejects with
  the abort reason. All event listeners and timers are cleaned up on every exit
  path (resolve, timeout, abort).

### Test mock export

Promote `test/helpers/mock-midi` to a shipped subpath **`midi-ports/testing`**,
exporting `createMockMidi` and its supporting types so consumers can unit-test
MIDI apps without hardware. It is a separate, tree-shakeable entry and does not
affect the main bundle.

---

## Cross-cutting

### Type additions (all additive)

- `MidiPortsOptions` gains: `aliases?: Record<string, string[]>`,
  `normalize?: (raw: string) => string`, `persist?: PersistOptions`,
  `roles?: Record<string, string[]>`.
- `MidiPorts` gains: `role(name)`, `assignRole(name, portName | null)`,
  `unresolvedRoles`, `waitFor(name, options?)`.
- New exports: `StorageAdapter`, `PersistOptions`, `MidiTimeoutError`, and from
  `midi-ports/testing`: `createMockMidi` (+ types).

### Module layout

- `src/normalize.ts` — grows the OS rules; stays a pure function for table tests.
- `src/persistence.ts` — `StorageAdapter`, load/save of the JSON document,
  microtask-coalesced writes, try/catch degradation.
- `src/roles.ts` — role resolution against the live ports map + assignment store.
- `src/wait.ts` — `waitFor` and `MidiTimeoutError`.
- `src/testing.ts` — re-exports the mock for the `./testing` entry.
- `src/factory.ts` — remains the wiring point: composes normalize/aliases,
  persistence hydrate/write, roles, and `waitFor` onto the returned object.

### Build / packaging

- `tsup` config gains a second entry (`src/testing.ts`).
- `package.json` `exports` adds a `./testing` subpath (types + import); `files`
  already ships `dist`.

### Testing strategy (vitest + mock MIDI)

- **normalize:** table tests over real-world macOS/Windows/Linux strings,
  including the false-merge cases; custom override and alias resolution; in/out
  merge under one canonical key.
- **persistence:** in-memory `StorageAdapter` — hydrate before first build,
  write-through coalescing, and graceful degradation when `getItem`/`setItem`
  throw.
- **roles:** resolution order, assignment + clear, `unresolvedRoles`, unknown-role
  throw, and persistence of assignments.
- **waitFor:** immediate resolve, resolve-on-connect, `requireBoth`, `timeout`
  (vitest fake timers), and `signal` abort; assert listener/timer cleanup.

### Docs

README sections for cross-platform names (with the caveat + override), persistence,
roles, and `waitFor`, plus the `midi-ports/testing` export. The changeset notes
the `normalize()` behavior change for Windows/Linux.

### Release

A single `minor` → 3.2.0. Implementation staged as commits (matching →
persistence → roles → ergonomics) but shipped together via one changeset.

## Open items to resolve during implementation

- Validate the exact Windows (`MIDIIN/OUT`, leading index) and Linux
  (` MIDI <n>`, `:<n>`) patterns against real hardware before finalizing the
  regexes.
- Confirm whether any additional macOS noise exists in practice (expected: none).
