# Topology Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add cross-platform name matching, metadata persistence, named-role resolution, and ergonomic helpers (`waitFor`, a shippable test mock) to `midi-ports`, shipped as 3.2.0.

**Architecture:** A single name **resolver** (built-in or custom `normalize`, then `aliases`) is threaded through port building, device grouping, lookups, roles, and `waitFor` so naming is consistent everywhere. Persistence is an opt-in, synchronous storage adapter that hydrates metadata/role stores before the first build and writes through (coalesced) on mutation. Roles resolve on-demand against the live ports map.

**Tech Stack:** TypeScript (ESM), tsup, vitest, biome, changesets, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-06-10-topology-hardening-design.md`

**Conventions for every task:**
- Run checks with the project's pinned pnpm: `CI=true npx pnpm@11.5.3 run <script>`.
- Commit messages must NOT include a `Co-Authored-By` trailer (global user preference).
- TDD: write the failing test, see it fail, implement minimally, see it pass, commit.

---

## File map

- `src/normalize.ts` — **modify**: add OS-noise stripping (pure).
- `src/resolve.ts` — **create**: `Normalizer` type + `createResolver(options)` (normalize override + aliases).
- `src/build-ports.ts` — **modify**: accept `resolve` + `onChange`; key/merge via `resolve`.
- `src/build-devices.ts` — **modify**: accept `resolve` + `onChange`; resolve config port names for lookup.
- `src/port.ts` — **modify**: `createPort` accepts optional `onChange`, called in `set()`.
- `src/device.ts` — **modify**: `createDevice` accepts `resolve` + optional `onChange`.
- `src/wait.ts` — **create**: `MidiTimeoutError` + `waitForPort(lookup, subscribe, options)`.
- `src/persistence.ts` — **create**: `StorageAdapter`, `PersistOptions`, `createPersistController`.
- `src/roles.ts` — **create**: `resolveRole(...)` pure helper.
- `src/testing.ts` — **create**: ships `createMockMidi` (moved from test helper).
- `src/factory.ts` — **modify**: wire resolver, persistence, roles, `waitFor`.
- `src/types.ts` — **modify**: extend `MidiPortsOptions` and `MidiPorts`.
- `tsup.config.ts`, `package.json` — **modify**: second entry + `./testing` export.
- `README.md`, `.changeset/*.md` — **modify/create**: docs + changeset.

---

## Task 1: OS-noise stripping in `normalize()`

**Files:**
- Modify: `src/normalize.ts`
- Test: `test/normalize.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// test/normalize.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/normalize.test.ts`
Expected: FAIL (Windows/Linux cases return the un-stripped value).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/normalize.ts
/**
 * Normalizes a MIDI port name or manufacturer into a stable map key:
 * strips OS-specific noise, then lowercases, removes commas, and collapses
 * runs of whitespace to a single hyphen.
 *
 * @example normalize('K-Mix Control Surface') // 'k-mix-control-surface'
 * @example normalize('MIDIIN2 (Launchkey)')   // 'launchkey'
 */
export function normalize(value: string): string {
  return stripOsNoise(value)
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
}

/**
 * Removes OS-specific decorations that would otherwise break the input/output
 * merge or cross-OS lookup. Heuristic and best-effort; consumers with
 * duplicate-name or multi-port rigs can override `normalize` via options.
 */
function stripOsNoise(value: string): string {
  let v = value.trim()
  // Windows: unwrap the direction marker, e.g. 'MIDIIN2 (Name)' -> 'Name'.
  const unwrapped = v.match(/^MIDI(?:IN|OUT)\d*\s*\((.+)\)$/i)?.[1]
  if (unwrapped) v = unwrapped
  // Windows: strip a leading enumeration index, e.g. '2- Name' -> 'Name'.
  v = v.replace(/^\d+-\s*/, '')
  // Linux/ALSA: strip a trailing port designator, e.g. 'Name MIDI 1' -> 'Name'.
  v = v.replace(/\s+MIDI\s+\d+$/i, '')
  // Linux/ALSA: strip a trailing client:port suffix, e.g. 'Name:0' -> 'Name'.
  v = v.replace(/:\d+$/, '')
  return v
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/normalize.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/normalize.ts test/normalize.test.ts
git commit -m "feat: strip OS-specific noise in normalize()"
```

---

## Task 2: Name resolver (normalize override + aliases)

**Files:**
- Create: `src/resolve.ts`
- Test: `test/resolve.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// test/resolve.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/resolve.test.ts`
Expected: FAIL with "Cannot find module './resolve.js'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/resolve.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/resolve.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/resolve.ts test/resolve.test.ts
git commit -m "feat: add name resolver with aliases and normalize override"
```

---

## Task 3: Thread the resolver + onChange through building and lookups

This wires the resolver into port building, device grouping, and lookups, and adds an `onChange` hook used later by persistence. Types are extended first so later code compiles.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/port.ts`
- Modify: `src/device.ts`
- Modify: `src/build-ports.ts`
- Modify: `src/build-devices.ts`
- Modify: `src/factory.ts`
- Test: `test/factory.test.ts` (extend)

- [ ] **Step 1: Write the failing test** (append to `test/factory.test.ts`)

```ts
  it('merges Windows MIDIIN/MIDIOUT halves into one canonical port', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'MIDIIN2 (Launchkey)', type: 'input' },
      { id: 'out-1', name: 'MIDIOUT2 (Launchkey)', type: 'output' },
    ])
    const mp = createMidiPorts(midi.access)
    expect(mp.ports.size).toBe(1)
    expect(mp.get('launchkey')?.inputID).toBe('in-1')
    expect(mp.get('launchkey')?.outputID).toBe('out-1')
  })

  it('resolves aliases for get() and device membership', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Mix Audio', type: 'input' }])
    const mp = createMidiPorts(midi.access, {
      aliases: { 'k-mix': ['K-Mix Audio'] },
      devices: { 'k-mix-dev': { ports: ['k-mix'] } },
    })
    expect(mp.get('k-mix')?.inputID).toBe('in-1')
    expect(mp.device('k-mix-dev')?.get('k-mix')?.inputID).toBe('in-1')
  })

  it('honors a custom normalize override', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'Funky Name', type: 'input' }])
    const mp = createMidiPorts(midi.access, { normalize: (raw) => raw.toUpperCase() })
    expect(mp.get('FUNKY NAME')?.inputID).toBe('in-1')
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/factory.test.ts`
Expected: FAIL (alias/override options not yet supported; merge already works via Task 1 but alias/override do not).

- [ ] **Step 3a: Extend `src/types.ts`**

Add to `MidiPortsOptions` (after `devices?`):

```ts
  /** Map variant device names to a canonical key. */
  aliases?: Record<string, string[]>
  /** Replace the built-in name normalization. */
  normalize?: (raw: string) => string
```

- [ ] **Step 3b: Modify `src/port.ts`** — add an `onChange` hook fired by `set()`.

In `CreatePortParams`, add:

```ts
  /** Called after metadata mutates, for write-through persistence. */
  onChange?: () => void
```

In `createPort`, destructure `onChange` and change `set`:

```ts
    set(key, value) {
      meta[key] = value
      onChange?.()
      return this
    },
```

- [ ] **Step 3c: Modify `src/device.ts`** — resolve `get()` via the injected resolver and fire `onChange`.

```ts
import type { Normalizer } from './resolve.js'
import type { Device, Port } from './types.js'

export interface CreateDeviceParams {
  name: string
  ports: Map<string, Port>
  meta: Record<string, unknown>
  resolve: Normalizer
  onChange?: () => void
}

export function createDevice(params: CreateDeviceParams): Device {
  const { name, ports, meta, resolve, onChange } = params

  const device: Device = {
    name,
    ports,
    get meta() {
      return meta
    },
    get(portName) {
      return ports.get(resolve(portName))
    },
    set(key, value) {
      meta[key] = value
      onChange?.()
      return this
    },
  }

  return device
}
```

- [ ] **Step 3d: Modify `src/build-ports.ts`** — key/merge via `resolve`, pass `onChange`.

Change the signature and the two `normalize(...)`/`createPort(...)` sites:

```ts
import { normalize } from './normalize.js'
import { createPort } from './port.js'
import type { Normalizer } from './resolve.js'
import type { Port } from './types.js'
// ...
export function buildPorts(
  access: MIDIAccess,
  metaStore: Map<string, Record<string, unknown>>,
  resolve: Normalizer,
  onChange?: () => void,
): Map<string, Port> {
  // ...
  const collect = (device: MIDIInput | MIDIOutput, kind: 'input' | 'output'): void => {
    const name = resolve(device.name ?? '')
    const entry: Accumulated = accumulated.get(name) ?? {
      displayName: device.name ?? '',
      manufacturer: normalize(device.manufacturer ?? ''),
    }
    // ... unchanged
  }
  // ...
    ports.set(
      name,
      createPort({
        name,
        displayName: entry.displayName,
        manufacturer: entry.manufacturer,
        inputID: entry.inputID,
        outputID: entry.outputID,
        access,
        meta,
        onChange,
      }),
    )
  // ...
}
```

- [ ] **Step 3e: Modify `src/build-devices.ts`** — resolve config port names for lookup; pass `resolve`/`onChange` to `createDevice`.

```ts
import { createDevice } from './device.js'
import type { Normalizer } from './resolve.js'
import type { Device, DevicesConfig, Port } from './types.js'
// ...
export function buildDevices(
  config: DevicesConfig,
  ports: ReadonlyMap<string, Port>,
  deviceMetaStore: Map<string, Record<string, unknown>>,
  resolve: Normalizer,
  onChange?: () => void,
): BuiltDevices {
  // ... inside the loop:
    const memberPorts = new Map<string, Port>()
    for (const portName of deviceConfig.ports) {
      const port = ports.get(resolve(portName))
      if (port) memberPorts.set(portName, port)
      else notFound.add(portName)
    }
    devices.set(deviceName, createDevice({ name: deviceName, ports: memberPorts, meta, resolve, onChange }))
  // ...
}
```

- [ ] **Step 3f: Modify `src/factory.ts`** — build the resolver and pass it everywhere.

```ts
import { createResolver } from './resolve.js'
// ...
export function createMidiPorts(access: MIDIAccess, options: MidiPortsOptions = {}): MidiPorts {
  const config = options.devices ?? {}
  const resolve = createResolver({ normalize: options.normalize, aliases: options.aliases })
  const metaStore = new Map<string, Record<string, unknown>>()
  const deviceMetaStore = new Map<string, Record<string, unknown>>()
  const emitter = createEmitter()

  let ports: Map<string, Port> = buildPorts(access, metaStore, resolve)
  let devices: Map<string, Device>
  let notFound: string[]

  const rebuild = (): void => {
    ports = buildPorts(access, metaStore, resolve)
    const built = buildDevices(config, ports, deviceMetaStore, resolve)
    devices = built.devices
    notFound = built.notFound
  }

  const initial = buildDevices(config, ports, deviceMetaStore, resolve)
  devices = initial.devices
  notFound = initial.notFound

  const handleStateChange = (raw: MIDIConnectionEvent): void => {
    const changed = raw.port
    if (!changed) return
    const name = resolve(changed.name ?? '')
    // ... rest unchanged
  }
  // ...
    get(name) {
      return ports.get(resolve(name))
    },
    device(name) {
      return devices.get(name)
    },
  // ...
}
```

(Note: `device(name)` stays an exact match on the config key, per spec.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `CI=true npx pnpm@11.5.3 run test`
Expected: PASS (all suites, including the new factory cases).

- [ ] **Step 5: Typecheck and commit**

```bash
CI=true npx pnpm@11.5.3 run typecheck
git add src/types.ts src/port.ts src/device.ts src/build-ports.ts src/build-devices.ts src/factory.ts test/factory.test.ts
git commit -m "feat: thread name resolver and onChange through building and lookups"
```

---

## Task 4: `waitFor` + `MidiTimeoutError`

**Files:**
- Create: `src/wait.ts`
- Test: `test/wait.test.ts` (create)
- Modify: `src/types.ts`, `src/factory.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/wait.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MidiTimeoutError, waitForPort } from '../src/wait.js'

const present = { isConnected: true, input: {}, output: {} } as never
const inputOnly = { isConnected: true, input: {}, output: undefined } as never

describe('waitForPort', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves immediately when the port is already present', async () => {
    const port = await waitForPort(() => present, () => () => {}, {})
    expect(port).toBe(present)
  })

  it('resolves when a later statechange satisfies the condition', async () => {
    let current: unknown
    let cb = () => {}
    const promise = waitForPort(() => current, (fn) => { cb = fn; return () => {} }, {})
    current = present
    cb()
    await expect(promise).resolves.toBe(present)
  })

  it('requireBoth waits for input and output', async () => {
    let current: unknown = inputOnly
    let cb = () => {}
    const promise = waitForPort(() => current, (fn) => { cb = fn; return () => {} }, { requireBoth: true })
    cb() // still input-only, should not resolve
    current = present
    cb()
    await expect(promise).resolves.toBe(present)
  })

  it('rejects with MidiTimeoutError after the timeout', async () => {
    const promise = waitForPort(() => undefined, () => () => {}, { timeout: 1000 })
    const assertion = expect(promise).rejects.toBeInstanceOf(MidiTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('rejects when the signal aborts', async () => {
    const controller = new AbortController()
    const promise = waitForPort(() => undefined, () => () => {}, { signal: controller.signal })
    controller.abort(new Error('cancelled'))
    await expect(promise).rejects.toThrow('cancelled')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/wait.test.ts`
Expected: FAIL with "Cannot find module '../src/wait.js'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/wait.ts
import type { Port } from './types.js'

/** Thrown when waitFor exceeds its timeout. */
export class MidiTimeoutError extends Error {
  constructor(message = 'Timed out waiting for MIDI port') {
    super(message)
    this.name = 'MidiTimeoutError'
  }
}

export interface WaitOptions {
  /** Reject with MidiTimeoutError after this many milliseconds. */
  timeout?: number
  /** Reject with the abort reason when this signal aborts. */
  signal?: AbortSignal
  /** Require both input and output to be present (default: either half). */
  requireBoth?: boolean
}

const satisfied = (port: Port | undefined, requireBoth: boolean): boolean =>
  !!port && (requireBoth ? !!port.input && !!port.output : port.isConnected)

/**
 * Resolves with the looked-up Port once it satisfies the condition. Checks
 * immediately, then re-checks on each subscribe callback. Cleans up the
 * subscription, timer, and abort listener on every exit path.
 */
export function waitForPort(
  lookup: () => Port | undefined,
  subscribe: (onChange: () => void) => () => void,
  options: WaitOptions = {},
): Promise<Port> {
  const requireBoth = options.requireBoth ?? false
  return new Promise<Port>((resolve, reject) => {
    let unsubscribe = () => {}
    let timer: ReturnType<typeof setTimeout> | undefined
    const onAbort = () => finish(() => reject(options.signal?.reason ?? new Error('Aborted')))

    const cleanup = (): void => {
      unsubscribe()
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
    }
    const finish = (settle: () => void): void => {
      cleanup()
      settle()
    }
    const check = (): void => {
      const port = lookup()
      if (satisfied(port, requireBoth)) finish(() => resolve(port as Port))
    }

    if (options.signal?.aborted) {
      reject(options.signal.reason ?? new Error('Aborted'))
      return
    }
    const port = lookup()
    if (satisfied(port, requireBoth)) {
      resolve(port as Port)
      return
    }

    unsubscribe = subscribe(check)
    if (options.timeout !== undefined) {
      timer = setTimeout(() => finish(() => reject(new MidiTimeoutError())), options.timeout)
    }
    options.signal?.addEventListener('abort', onAbort)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/wait.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the factory and types**

In `src/types.ts`, add to the `MidiPorts` interface (after `device(name)`):

```ts
  /** Resolve once a port (by raw or canonical name) is present. */
  waitFor(name: string, options?: WaitOptions): Promise<Port>
```

And add the import/re-export at the top of `src/types.ts`:

```ts
import type { WaitOptions } from './wait.js'
export type { WaitOptions } from './wait.js'
```

In `src/factory.ts`, import and implement:

```ts
import { waitForPort } from './wait.js'
// ... in the returned object, after device(name):
    waitFor(name, options) {
      const key = resolve(name)
      return waitForPort(
        () => ports.get(key),
        (onChange) => emitter.on('statechange', onChange),
        options,
      )
    },
```

(Note: `emitter.on('statechange', handler)` passes the event arg the handler ignores; `onChange` takes no args, which is compatible.)

- [ ] **Step 6: Run all tests, typecheck, commit**

```bash
CI=true npx pnpm@11.5.3 run test
CI=true npx pnpm@11.5.3 run typecheck
git add src/wait.ts src/types.ts src/factory.ts test/wait.test.ts
git commit -m "feat: add waitFor and MidiTimeoutError"
```

---

## Task 5: Persistence

**Files:**
- Create: `src/persistence.ts`
- Test: `test/persistence.test.ts` (create)
- Modify: `src/types.ts`, `src/factory.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/persistence.test.ts
import { describe, expect, it, vi } from 'vitest'
import { createPersistController } from '../src/persistence.js'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

describe('createPersistController', () => {
  it('loads an empty doc when nothing is stored', () => {
    const ctrl = createPersistController({ key: 'k', storage: memoryStorage() })
    expect(ctrl.load()).toEqual({})
  })

  it('round-trips a saved document (coalesced)', async () => {
    const storage = memoryStorage()
    const ctrl = createPersistController({ key: 'k', storage })
    ctrl.save({ ports: { 'k-board': { color: 'red' } } })
    ctrl.save({ ports: { 'k-board': { color: 'blue' } } })
    await Promise.resolve() // let the microtask flush
    expect(JSON.parse(storage._map.get('k') as string)).toEqual({ ports: { 'k-board': { color: 'blue' } } })
  })

  it('degrades gracefully when storage throws', async () => {
    const throwing = {
      getItem: () => { throw new Error('boom') },
      setItem: () => { throw new Error('boom') },
      removeItem: () => {},
    }
    const ctrl = createPersistController({ key: 'k', storage: throwing })
    expect(ctrl.load()).toEqual({})
    ctrl.save({ roles: { a: 'b' } })
    await Promise.resolve()
    // no throw == pass
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/persistence.test.ts`
Expected: FAIL with "Cannot find module '../src/persistence.js'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/persistence.ts

/** Minimal synchronous storage interface; localStorage satisfies it. */
export interface StorageAdapter {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PersistOptions {
  /** Storage key namespace. */
  key: string
  /** Storage backend; defaults to localStorage when available. */
  storage?: StorageAdapter
}

/** Shape of the persisted document. */
export interface PersistDoc {
  ports?: Record<string, Record<string, unknown>>
  devices?: Record<string, Record<string, unknown>>
  roles?: Record<string, string>
}

export interface PersistController {
  load(): PersistDoc
  /** Persist the document; writes are coalesced to one per microtask. */
  save(doc: PersistDoc): void
}

function defaultStorage(): StorageAdapter | undefined {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : undefined
  } catch {
    return undefined
  }
}

export function createPersistController(options: PersistOptions): PersistController {
  const storage = options.storage ?? defaultStorage()
  let pending: PersistDoc | undefined
  let scheduled = false

  const flush = (): void => {
    scheduled = false
    if (!storage || pending === undefined) return
    try {
      storage.setItem(options.key, JSON.stringify(pending))
    } catch {
      // Quota/unavailable: degrade to in-memory silently.
    }
    pending = undefined
  }

  return {
    load() {
      if (!storage) return {}
      try {
        const raw = storage.getItem(options.key)
        return raw ? (JSON.parse(raw) as PersistDoc) : {}
      } catch {
        return {}
      }
    },
    save(doc) {
      pending = doc
      if (!scheduled) {
        scheduled = true
        queueMicrotask(flush)
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/persistence.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire into the factory and types**

In `src/types.ts`, add to `MidiPortsOptions`:

```ts
  /** Opt-in persistence of metadata and role assignments. */
  persist?: PersistOptions
```

and at the top:

```ts
import type { PersistOptions } from './persistence.js'
export type { PersistOptions, StorageAdapter } from './persistence.js'
```

In `src/factory.ts`, after creating the meta stores, add hydration and a coalesced save (role assignments are added in Task 6; include the `roles` map now as an empty `Map`):

```ts
import { createPersistController } from './persistence.js'
// ...
  const roleAssignments = new Map<string, string>() // role -> canonical port name (Task 6)
  const persist = options.persist ? createPersistController(options.persist) : undefined

  if (persist) {
    const doc = persist.load()
    for (const [k, v] of Object.entries(doc.ports ?? {})) metaStore.set(k, { ...v })
    for (const [k, v] of Object.entries(doc.devices ?? {})) deviceMetaStore.set(k, { ...v })
    for (const [k, v] of Object.entries(doc.roles ?? {})) roleAssignments.set(k, v)
  }

  const mapToObj = <V>(m: Map<string, V>): Record<string, V> =>
    Object.fromEntries(m.entries())
  const scheduleSave = (): void => {
    persist?.save({
      ports: mapToObj(metaStore),
      devices: mapToObj(deviceMetaStore),
      roles: mapToObj(roleAssignments),
    })
  }
```

Then pass `scheduleSave` as the `onChange` argument wherever ports/devices are built:

```ts
  let ports: Map<string, Port> = buildPorts(access, metaStore, resolve, scheduleSave)
  // in rebuild():
    ports = buildPorts(access, metaStore, resolve, scheduleSave)
    const built = buildDevices(config, ports, deviceMetaStore, resolve, scheduleSave)
  // and the initial buildDevices(...) call:
  const initial = buildDevices(config, ports, deviceMetaStore, resolve, scheduleSave)
```

- [ ] **Step 6: Add a hydration test** (append to `test/factory.test.ts`)

```ts
  it('hydrates port metadata from persistence before first build', () => {
    const store = new Map<string, string>([
      ['app:midi', JSON.stringify({ ports: { 'k-board': { color: 'red' } } })],
    ])
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    }
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access, { persist: { key: 'app:midi', storage } })
    expect(mp.get('k-board')?.meta).toEqual({ color: 'red' })
  })
```

- [ ] **Step 7: Run all tests, typecheck, commit**

```bash
CI=true npx pnpm@11.5.3 run test
CI=true npx pnpm@11.5.3 run typecheck
git add src/persistence.ts src/types.ts src/factory.ts test/persistence.test.ts test/factory.test.ts
git commit -m "feat: add opt-in metadata persistence"
```

---

## Task 6: Named-role resolution

**Files:**
- Create: `src/roles.ts`
- Test: `test/roles.test.ts` (create)
- Modify: `src/types.ts`, `src/factory.ts`

- [ ] **Step 1: Write the failing test**

```ts
// test/roles.test.ts
import { describe, expect, it } from 'vitest'
import { createMidiPorts } from '../src/factory.js'
import { createMockMidi } from '../src/testing.js'

const roles = { 'drum-out': ['sp-404', 'launchpad'] }

describe('roles', () => {
  it('resolves the first connected candidate in order', () => {
    const midi = createMockMidi([{ id: 'o1', name: 'Launchpad', type: 'output' }])
    const mp = createMidiPorts(midi.access, { roles })
    expect(mp.role('drum-out')?.name).toBe('launchpad')
  })

  it('lists roles with no connected candidate in unresolvedRoles', () => {
    const midi = createMockMidi([])
    const mp = createMidiPorts(midi.access, { roles })
    expect(mp.unresolvedRoles).toEqual(['drum-out'])
  })

  it('prefers a persisted assignment when connected', () => {
    const midi = createMockMidi([
      { id: 'o1', name: 'SP-404', type: 'output' },
      { id: 'o2', name: 'Launchpad', type: 'output' },
    ])
    const mp = createMidiPorts(midi.access, { roles })
    mp.assignRole('drum-out', 'Launchpad')
    expect(mp.role('drum-out')?.name).toBe('launchpad')
    mp.assignRole('drum-out', null)
    expect(mp.role('drum-out')?.name).toBe('sp-404')
  })

  it('throws on an unknown role', () => {
    const midi = createMockMidi([])
    const mp = createMidiPorts(midi.access, { roles })
    expect(() => mp.assignRole('nope', 'x')).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `CI=true npx pnpm@11.5.3 exec vitest run test/roles.test.ts`
Expected: FAIL (role/assignRole/unresolvedRoles not defined; `src/testing.js` arrives in Task 7 — if this errors on the import, temporarily import from `./helpers/mock-midi.js`, then switch back after Task 7).

- [ ] **Step 3: Write the pure resolver**

```ts
// src/roles.ts
import type { Normalizer } from './resolve.js'
import type { Port } from './types.js'

/**
 * Resolves a role to a Port: a connected persisted assignment wins, else the
 * first connected config candidate in order, else undefined.
 */
export function resolveRole(
  candidates: string[],
  assignment: string | undefined,
  getPort: (canonical: string) => Port | undefined,
  resolve: Normalizer,
): Port | undefined {
  if (assignment) {
    const assigned = getPort(assignment)
    if (assigned?.isConnected) return assigned
  }
  for (const candidate of candidates) {
    const port = getPort(resolve(candidate))
    if (port?.isConnected) return port
  }
  return undefined
}
```

- [ ] **Step 4: Wire into the factory and types**

In `src/types.ts`, add to `MidiPortsOptions`:

```ts
  /** Named roles, each an ordered list of candidate port names. */
  roles?: Record<string, string[]>
```

and to `MidiPorts` (after `waitFor`):

```ts
  /** Resolve a role to its first connected candidate (or a persisted override). */
  role(name: string): Port | undefined
  /** Set or clear (null) a persisted port override for a role. Throws on unknown role. */
  assignRole(name: string, portName: string | null): void
  /** Roles with no currently-connected candidate. */
  readonly unresolvedRoles: string[]
```

In `src/factory.ts`, add the config and methods (`roleAssignments` already exists from Task 5):

```ts
import { resolveRole } from './roles.js'
// ...
  const roleConfig = options.roles ?? {}
// ... in the returned object:
    role(name) {
      const candidates = roleConfig[name] ?? []
      return resolveRole(candidates, roleAssignments.get(name), (c) => ports.get(c), resolve)
    },
    assignRole(name, portName) {
      if (!(name in roleConfig)) throw new Error(`Unknown role '${name}'`)
      if (portName == null) roleAssignments.delete(name)
      else roleAssignments.set(name, resolve(portName))
      scheduleSave()
    },
    get unresolvedRoles() {
      return Object.keys(roleConfig).filter(
        (name) => !resolveRole(roleConfig[name] ?? [], roleAssignments.get(name), (c) => ports.get(c), resolve),
      )
    },
```

- [ ] **Step 5: Run all tests, typecheck, commit**

```bash
CI=true npx pnpm@11.5.3 run test
CI=true npx pnpm@11.5.3 run typecheck
git add src/roles.ts src/types.ts src/factory.ts test/roles.test.ts
git commit -m "feat: add named-role resolution"
```

---

## Task 7: Ship the test mock as `midi-ports/testing`

**Files:**
- Create: `src/testing.ts` (move from `test/helpers/mock-midi.ts`)
- Modify: `tsup.config.ts`, `package.json`
- Modify: import paths in `test/*.test.ts` that use the mock

- [ ] **Step 1: Read the existing mock**

Run: `cat test/helpers/mock-midi.ts`
Note its exports (`createMockMidi` and any types).

- [ ] **Step 2: Move it into `src/` and re-point the old path**

```bash
git mv test/helpers/mock-midi.ts src/testing.ts
```

Create a thin re-export so existing test imports keep working:

```ts
// test/helpers/mock-midi.ts
export * from '../../src/testing.js'
```

- [ ] **Step 3: Add the second build entry** in `tsup.config.ts`

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/testing.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
```

(Match the existing options in the file; only `entry` changes to add `src/testing.ts`.)

- [ ] **Step 4: Add the `./testing` export** in `package.json` (inside `exports`)

```json
    "./testing": {
      "types": "./dist/testing.d.ts",
      "import": "./dist/testing.js"
    }
```

- [ ] **Step 5: Verify build emits both entries**

Run: `CI=true npx pnpm@11.5.3 run build && ls dist`
Expected: `index.js`, `index.d.ts`, `testing.js`, `testing.d.ts` all present.

- [ ] **Step 6: Run tests, typecheck, commit**

```bash
CI=true npx pnpm@11.5.3 run test
CI=true npx pnpm@11.5.3 run typecheck
git add src/testing.ts test/helpers/mock-midi.ts tsup.config.ts package.json
git commit -m "feat: ship the test mock as midi-ports/testing"
```

---

## Task 8: Docs + changeset

**Files:**
- Modify: `README.md`
- Create: `.changeset/topology-hardening.md`

- [ ] **Step 1: Add README sections**

Add concise sections after the existing topology docs:
- **Cross-platform names** — what is stripped per OS, the false-merge caveat, and the `aliases` + `normalize` escape hatches.
- **Persistence** — the `persist` option, the `StorageAdapter` shape, what is stored, and SSR/private-mode degradation.
- **Roles** — `roles` config, `role()`, `assignRole()`, `unresolvedRoles`.
- **Waiting for a device** — `waitFor(name, { timeout, signal, requireBoth })` and `MidiTimeoutError`.
- **Testing** — `import { createMockMidi } from 'midi-ports/testing'`.

Update the API list to include `waitFor`, `role`, `assignRole`, `unresolvedRoles`, and the new options.

- [ ] **Step 2: Write the changeset**

```md
---
'midi-ports': minor
---

Cross-platform name matching, opt-in persistence, named-role resolution, and ergonomic helpers.

- `normalize()` now strips OS-specific noise (Windows `MIDIIN/MIDIOUT` wrappers and `N-` index prefixes; Linux/ALSA ` MIDI <n>` and `:<n>` suffixes) so input/output halves merge and keys are portable across OSes. **Behavior change:** canonical keys / `port.name` differ for previously-mangled Windows/Linux names. New `aliases` and `normalize` options cover names the heuristics can't reconcile.
- New `persist` option writes port/device metadata and role assignments through a pluggable `StorageAdapter` (defaults to localStorage), hydrated before the first build.
- New `roles` config with `role()`, `assignRole()`, and `unresolvedRoles`.
- New `waitFor(name, options?)` resolving when a port appears (`timeout`/`signal`/`requireBoth`), plus `MidiTimeoutError`.
- New `midi-ports/testing` entry exporting `createMockMidi` for consumers' tests.
```

- [ ] **Step 3: Verify docs build/lint and commit**

```bash
CI=true npx pnpm@11.5.3 run lint
git add README.md .changeset/topology-hardening.md
git commit -m "docs: document topology-hardening features; add changeset"
```

---

## Task 9: Full verification and release

- [ ] **Step 1: Run the full check suite**

```bash
CI=true npx pnpm@11.5.3 run lint
CI=true npx pnpm@11.5.3 run typecheck
CI=true npx pnpm@11.5.3 run test
CI=true npx pnpm@11.5.3 run build
```
Expected: all exit 0.

- [ ] **Step 2: Push and let CI run**

```bash
git fetch origin master && git rebase origin/master
git push origin master
```
Expected: CI workflow green.

- [ ] **Step 3: Merge the Version Packages PR**

After the Release workflow opens the `Version Packages` PR (→ 3.2.0), verify its diff (version `3.2.0`, changelog entry), then merge:

```bash
gh api -X PUT repos/andrejhronco/midi-ports/pulls/<N>/merge -f merge_method=squash --jq '{merged, message}'
```

- [ ] **Step 4: Confirm publish**

Watch the Release run; then:

```bash
npm view midi-ports version   # expect 3.2.0
```

---

## Self-review notes

- **Spec coverage:** Feature 1 → Tasks 1–3; Feature 2 → Task 5; Feature 3 → Task 6; Feature 4 → Tasks 4 (`waitFor`) and 7 (testing export); cross-cutting types/build/docs/release → Tasks 3–9.
- **Type consistency:** `Normalizer`/`createResolver` (Task 2) reused in Tasks 3–6; `StorageAdapter`/`PersistOptions`/`PersistDoc`/`createPersistController` (Task 5) consistent; `roleAssignments` introduced in Task 5 and consumed in Task 6; `waitForPort`/`WaitOptions`/`MidiTimeoutError` (Task 4) match the factory wiring.
- **Ordering note:** `src/testing.ts` (Task 7) is imported by `test/roles.test.ts` (Task 6). Task 6 Step 2 calls this out: import from the existing `./helpers/mock-midi.js` if running Task 6 before Task 7, then the moved module satisfies it afterward.
- **Validation reminder:** the Windows/Linux regexes in Task 1 are heuristics — validate against real hardware where possible; the `normalize` override exists for cases they miss.
