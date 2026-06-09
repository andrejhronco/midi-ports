# midi-ports v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the `midi-ports` package as a type-safe, ESM-only TypeScript v3.0.0 with a factory + `Port`-handle API, grouped devices, not-found tracking, custom metadata, hot-plug events, and a Biome/Vitest/tsup/Changesets toolchain.

**Architecture:** A factory (`createMidiPorts` / `requestMidiPorts`) wraps an `MIDIAccess` and returns a plain typed `MidiPorts` object. Internally it builds a name-keyed `Map<string, Port>` from the access object's inputs/outputs (merging input+output by normalized name), optionally groups them into `Device`s from a config, and listens for `statechange` to keep everything live while emitting connect/disconnect events. Each `Port` is a small handle with live `.input`/`.output` getters resolved against `MIDIAccess`, a `send` convenience, and a metadata bag that survives reconnects via an internal per-name store.

**Tech Stack:** TypeScript (strict, ESM; Web MIDI types come from the built-in DOM lib — no `@types/webmidi`), tsup (build), Vitest (test), Biome (lint+format), Changesets (release), GitHub Actions (CI), pnpm.

**Reference spec:** `docs/superpowers/specs/2026-06-09-midi-ports-v3-redesign-design.md`

---

## File Structure

```
src/
  index.ts          # public exports + re-exported types
  factory.ts        # createMidiPorts / requestMidiPorts, statechange wiring, dispose
  port.ts           # createPort → Port
  device.ts         # createDevice → Device
  build-ports.ts    # MIDIAccess → Map<name, Port> (merge input+output by name)
  build-devices.ts  # DevicesConfig + ports → { devices, notFound }
  normalize.ts      # name normalization
  events.ts         # tiny typed emitter (createEmitter)
  errors.ts         # MidiUnsupportedError
  types.ts          # shared interfaces (MidiPorts, Port, Device, options, events)
test/
  helpers/mock-midi.ts   # fake MIDIAccess / MIDIInput / MIDIOutput + connect/disconnect
  normalize.test.ts
  build-ports.test.ts
  port.test.ts
  build-devices.test.ts
  device.test.ts
  factory.test.ts
config/build files: package.json, tsconfig.json, tsup.config.ts, vitest.config.ts,
  biome.json, .gitignore, .changeset/config.json,
  .github/workflows/ci.yml, .github/workflows/release.yml
README.md (rewritten)
```

**Convention:** delete the legacy `index.js` during scaffolding (Task 1). All new code is TypeScript under `src/`.

---

## Task 1: Project scaffolding & tooling

**Files:**
- Delete: `index.js`
- Create: `package.json` (replace), `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `biome.json`, `.gitignore` (replace)

- [ ] **Step 1: Remove legacy source and stale gitignore**

```bash
cd ~/code/midi-ports
git rm index.js
```

- [ ] **Step 2: Replace `package.json`**

Create `package.json` with this exact content:

```json
{
  "name": "midi-ports",
  "version": "3.0.0",
  "description": "Type-safe Web MIDI helper: wrap MIDIAccess and access input/output ports by name, with grouped devices, not-found tracking, metadata, and hot-plug events.",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "engines": { "node": ">=18" },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build",
    "release": "changeset publish"
  },
  "keywords": ["webmidi", "web-midi", "midi", "midiports", "ports", "midiaccess", "typescript"],
  "author": "Andrej Hronco",
  "license": "MIT",
  "repository": { "type": "git", "url": "git+https://github.com/andrejhronco/midi-ports.git" },
  "homepage": "https://github.com/andrejhronco/midi-ports#readme",
  "bugs": { "url": "https://github.com/andrejhronco/midi-ports/issues" },
  "devDependencies": {},
  "dependencies": {}
}
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "dist",
    "noEmit": true
  },
  "include": ["src", "test", "*.config.ts"]
}
```

- [ ] **Step 4: Create `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
})
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: { provider: 'v8', include: ['src/**'] },
  },
})
```

- [ ] **Step 6: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/2.4.16/schema.json",
  "files": { "includes": ["src/**", "test/**", "*.ts"] },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "javascript": {
    "formatter": { "quoteStyle": "single", "semicolons": "asNeeded", "trailingCommas": "all" }
  },
  "assist": { "actions": { "source": { "organizeImports": "on" } } }
}
```

- [ ] **Step 7: Replace `.gitignore`**

```
node_modules
dist
coverage
*.log
.DS_Store
```

- [ ] **Step 8: Enable pnpm and install dependencies**

Run:

```bash
cd ~/code/midi-ports
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm add -D typescript@5 tsup@8 vitest@4 @vitest/coverage-v8@4 @biomejs/biome@2 @changesets/cli@2
```

Expected: a `pnpm-lock.yaml` is created and `node_modules` populated. `pnpm` reports the packages added to `devDependencies`.

> Note: do **not** install `@types/webmidi` — it is a deprecated empty stub and TypeScript's built-in DOM lib already provides `MIDIAccess`, `MIDIInput`, `MIDIOutput`, `MIDIConnectionEvent`, etc.

- [ ] **Step 9: Verify the toolchain runs (empty state)**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: exits 0 with no output (no `src` files yet, nothing to check besides config). If it errors that there are no inputs, that's fine — proceed.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold TypeScript/ESM toolchain (tsup, vitest, biome, changesets)"
```

---

## Task 2: Mock Web MIDI test helper

The mock fakes `MIDIAccess` with `inputs`/`outputs` maps and lets tests fire `statechange`. Every later test depends on it.

**Files:**
- Create: `test/helpers/mock-midi.ts`

- [ ] **Step 1: Create `test/helpers/mock-midi.ts`**

```ts
/**
 * Minimal fakes for the Web MIDI API, sufficient for testing midi-ports.
 * Web MIDI global types (MIDIAccess, MIDIInput, ...) come from the TS DOM lib.
 */

export interface PortSpec {
  id: string
  name: string
  manufacturer?: string
  type: 'input' | 'output'
}

export interface MockMidi {
  /** The fake object to pass into createMidiPorts. */
  access: MIDIAccess
  /** Records every output.send([...]) call, in order. */
  sent: Array<{ id: string; data: number[] }>
  /** Adds a port and fires a 'connected' statechange. Returns the fake port. */
  connect(spec: PortSpec): MIDIPort
  /** Removes a port and fires a 'disconnected' statechange. Returns the fake port. */
  disconnect(spec: PortSpec): MIDIPort
}

export function createMockMidi(specs: PortSpec[] = []): MockMidi {
  const inputs = new Map<string, MIDIInput>()
  const outputs = new Map<string, MIDIOutput>()
  const listeners = new Set<(e: MIDIConnectionEvent) => void>()
  const sent: Array<{ id: string; data: number[] }> = []

  function makePort(spec: PortSpec, state: 'connected' | 'disconnected'): MIDIInput | MIDIOutput {
    const base = {
      id: spec.id,
      name: spec.name,
      manufacturer: spec.manufacturer ?? '',
      type: spec.type,
      state,
      connection: 'closed' as MIDIPortConnectionState,
      version: '1',
      onstatechange: null,
      open() {
        return Promise.resolve(this as unknown as MIDIPort)
      },
      close() {
        return Promise.resolve(this as unknown as MIDIPort)
      },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true
      },
    }
    if (spec.type === 'output') {
      return {
        ...base,
        onmidimessage: null,
        send(data: number[]) {
          sent.push({ id: spec.id, data })
        },
        clear() {},
      } as unknown as MIDIOutput
    }
    return { ...base, onmidimessage: null } as unknown as MIDIInput
  }

  function add(spec: PortSpec): MIDIPort {
    const port = makePort(spec, 'connected')
    if (spec.type === 'input') inputs.set(spec.id, port as MIDIInput)
    else outputs.set(spec.id, port as MIDIOutput)
    return port as unknown as MIDIPort
  }

  for (const spec of specs) add(spec)

  function fire(port: MIDIPort): void {
    const event = { port } as unknown as MIDIConnectionEvent
    for (const handler of listeners) handler(event)
  }

  const access = {
    inputs,
    outputs,
    sysexEnabled: false,
    onstatechange: null,
    addEventListener(type: string, handler: (e: MIDIConnectionEvent) => void) {
      if (type === 'statechange') listeners.add(handler)
    },
    removeEventListener(type: string, handler: (e: MIDIConnectionEvent) => void) {
      if (type === 'statechange') listeners.delete(handler)
    },
    dispatchEvent() {
      return true
    },
  } as unknown as MIDIAccess

  return {
    access,
    sent,
    connect(spec) {
      const port = add(spec)
      fire(port)
      return port
    },
    disconnect(spec) {
      const map = spec.type === 'input' ? inputs : outputs
      const existing = map.get(spec.id)
      map.delete(spec.id)
      const port = (existing as unknown as MIDIPort) ?? makePort(spec, 'disconnected')
      ;(port as { state: MIDIPortDeviceState }).state = 'disconnected'
      fire(port)
      return port
    },
  }
}
```

- [ ] **Step 2: Typecheck the helper**

Run:

```bash
pnpm exec tsc --noEmit
```

Expected: exits 0. (`MIDIPortConnectionState` / `MIDIPortDeviceState` / `MIDIAccess` etc. are provided by the built-in DOM lib via `"lib": ["ES2022", "DOM", "DOM.Iterable"]`.)

- [ ] **Step 3: Commit**

```bash
git add test/helpers/mock-midi.ts
git commit -m "test: add Web MIDI mock helper"
```

---

## Task 3: Name normalization

**Files:**
- Create: `src/normalize.ts`
- Test: `test/normalize.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/normalize.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/normalize.test.ts`
Expected: FAIL — cannot resolve `../src/normalize.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/normalize.ts`:

```ts
/**
 * Normalizes a MIDI port name or manufacturer into a stable map key:
 * lowercased, commas removed, runs of whitespace collapsed to a single hyphen.
 *
 * @example normalize('K-Mix Control Surface') // 'k-mix-control-surface'
 */
export function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/,/g, '')
    .replace(/\s+/g, '-')
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/normalize.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/normalize.ts test/normalize.test.ts
git commit -m "feat: add name normalization"
```

---

## Task 4: Shared types & errors

These are pure type/declaration modules consumed by everything else. No test of their own (they are exercised through later tasks).

**Files:**
- Create: `src/types.ts`, `src/errors.ts`

- [ ] **Step 1: Create `src/errors.ts`**

```ts
/** Thrown when the runtime has no Web MIDI support (navigator.requestMIDIAccess missing). */
export class MidiUnsupportedError extends Error {
  constructor(message = 'Web MIDI API is not supported in this environment') {
    super(message)
    this.name = 'MidiUnsupportedError'
  }
}
```

- [ ] **Step 2: Create `src/types.ts`**

```ts
/** Options accepted by createMidiPorts / requestMidiPorts. */
export interface MidiPortsOptions {
  /** Request SysEx permission. Only used by requestMidiPorts. */
  sysex?: boolean
  /** Request software-synth access. Only used by requestMidiPorts. */
  software?: boolean
  /** Optional grouping of ports into named devices. */
  devices?: DevicesConfig
}

/** Configuration describing how to group ports into named devices. */
export interface DevicesConfig {
  [deviceName: string]: {
    /** Expected normalized port names that belong to this device. */
    ports: string[]
    /** Optional device-level metadata (icon, manufacturer, etc.). */
    meta?: Record<string, unknown>
  }
}

/** A single MIDI port, keyed by its normalized name, with live input/output access. */
export interface Port {
  /** Normalized key, e.g. 'k-mix-control-surface'. */
  readonly name: string
  /** Original device name, e.g. 'K-Mix Control Surface'. */
  readonly displayName: string
  /** Normalized manufacturer string. */
  readonly manufacturer: string
  /** Underlying MIDIInput id, if this port has an input. */
  readonly inputID?: string
  /** Underlying MIDIOutput id, if this port has an output. */
  readonly outputID?: string
  /** Live MIDIInput resolved against MIDIAccess, or undefined. */
  readonly input?: MIDIInput
  /** Live MIDIOutput resolved against MIDIAccess, or undefined. */
  readonly output?: MIDIOutput
  /** True when an input or output currently resolves. */
  readonly isConnected: boolean
  /** Read-only view of this port's custom metadata. */
  readonly meta: Readonly<Record<string, unknown>>
  /** Send a MIDI message via this port's output. Throws if there is no output. Chainable. */
  send(data: number[] | Uint8Array, timestamp?: number): this
  /** Attach arbitrary metadata to this port. Chainable. Survives reconnects. */
  set(key: string, value: unknown): this
}

/** A named group of ports plus device-level metadata. */
export interface Device {
  readonly name: string
  readonly ports: ReadonlyMap<string, Port>
  /** Read-only view of this device's metadata. */
  readonly meta: Readonly<Record<string, unknown>>
  /** Look up a member port by its normalized name. */
  get(portName: string): Port | undefined
  /** Attach arbitrary metadata to this device. Chainable. */
  set(key: string, value: unknown): this
}

export type MidiPortEventType = 'connect' | 'disconnect' | 'statechange'

/** Payload delivered to event subscribers. */
export interface MidiPortEvent {
  type: 'connect' | 'disconnect'
  /** The affected Port handle. */
  port: Port
  /** The raw browser connection event. */
  raw: MIDIConnectionEvent
}

/** The object returned by createMidiPorts / requestMidiPorts. */
export interface MidiPorts {
  readonly access: MIDIAccess
  /** All currently-connected ports, keyed by normalized name. */
  readonly ports: ReadonlyMap<string, Port>
  /** Grouped devices (empty unless a devices config was provided). */
  readonly devices: ReadonlyMap<string, Device>
  /** Expected port names (from config) not currently connected. */
  readonly notFound: string[]
  /** Look up a port by its normalized name. */
  get(name: string): Port | undefined
  /** Look up a grouped device by name. */
  device(name: string): Device | undefined
  /** Subscribe to an event. Returns an unsubscribe function. */
  on(event: MidiPortEventType, handler: (event: MidiPortEvent) => void): () => void
  /** Remove a previously-registered handler. */
  off(event: MidiPortEventType, handler: (event: MidiPortEvent) => void): void
  /** Detach the statechange listener and clear all subscribers. */
  dispose(): void
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/errors.ts
git commit -m "feat: add shared types and MidiUnsupportedError"
```

---

## Task 5: Port handle

**Files:**
- Create: `src/port.ts`
- Test: `test/port.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/port.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createPort } from '../src/port.js'
import { createMockMidi } from './helpers/mock-midi.js'

describe('createPort', () => {
  it('exposes identity fields', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const meta = {}
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: 'kesumo-llc',
      inputID: 'in-1',
      access: midi.access,
      meta,
    })
    expect(port.name).toBe('k-board')
    expect(port.displayName).toBe('K-Board')
    expect(port.manufacturer).toBe('kesumo-llc')
    expect(port.inputID).toBe('in-1')
    expect(port.outputID).toBeUndefined()
  })

  it('resolves live input/output and isConnected', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Board', type: 'input' },
      { id: 'out-1', name: 'K-Board', type: 'output' },
    ])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      inputID: 'in-1',
      outputID: 'out-1',
      access: midi.access,
      meta: {},
    })
    expect(port.input?.id).toBe('in-1')
    expect(port.output?.id).toBe('out-1')
    expect(port.isConnected).toBe(true)
  })

  it('send() forwards to the output and is chainable', () => {
    const midi = createMockMidi([{ id: 'out-1', name: 'K-Board', type: 'output' }])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      outputID: 'out-1',
      access: midi.access,
      meta: {},
    })
    expect(port.send([144, 60, 127])).toBe(port)
    expect(midi.sent).toEqual([{ id: 'out-1', data: [144, 60, 127] }])
  })

  it('send() throws when there is no output', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      inputID: 'in-1',
      access: midi.access,
      meta: {},
    })
    expect(() => port.send([144, 60, 127])).toThrow(/no output/i)
  })

  it('set() writes metadata, is chainable, and meta reflects it', () => {
    const midi = createMockMidi()
    const meta: Record<string, unknown> = {}
    const port = createPort({
      name: 'k-board',
      displayName: 'K-Board',
      manufacturer: '',
      access: midi.access,
      meta,
    })
    expect(port.set('quality', 'great').set('price', 99)).toBe(port)
    expect(port.meta).toEqual({ quality: 'great', price: 99 })
    // metadata is written through to the shared store object
    expect(meta).toEqual({ quality: 'great', price: 99 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/port.test.ts`
Expected: FAIL — cannot resolve `../src/port.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/port.ts`:

```ts
import type { Port } from './types.js'

export interface CreatePortParams {
  name: string
  displayName: string
  manufacturer: string
  inputID?: string
  outputID?: string
  access: MIDIAccess
  /** Shared metadata record (owned by the factory's per-name store). */
  meta: Record<string, unknown>
}

export function createPort(params: CreatePortParams): Port {
  const { name, displayName, manufacturer, inputID, outputID, access, meta } = params

  const port: Port = {
    name,
    displayName,
    manufacturer,
    inputID,
    outputID,
    get input() {
      return inputID ? access.inputs.get(inputID) : undefined
    },
    get output() {
      return outputID ? access.outputs.get(outputID) : undefined
    },
    get isConnected() {
      return Boolean(this.input || this.output)
    },
    get meta() {
      return meta
    },
    send(data, timestamp) {
      const output = this.output
      if (!output) {
        throw new Error(`Port '${name}' has no output to send on`)
      }
      output.send(data, timestamp)
      return this
    },
    set(key, value) {
      meta[key] = value
      return this
    },
  }

  return port
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/port.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/port.ts test/port.test.ts
git commit -m "feat: add Port handle"
```

---

## Task 6: Build ports from MIDIAccess

**Files:**
- Create: `src/build-ports.ts`
- Test: `test/build-ports.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/build-ports.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPorts } from '../src/build-ports.js'
import { createMockMidi } from './helpers/mock-midi.js'

describe('buildPorts', () => {
  it('merges input and output that share a name into one port', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Board', manufacturer: 'Kesumo, LLC', type: 'input' },
      { id: 'out-1', name: 'K-Board', manufacturer: 'Kesumo, LLC', type: 'output' },
    ])
    const ports = buildPorts(midi.access, new Map())
    expect(ports.size).toBe(1)
    const port = ports.get('k-board')
    expect(port?.inputID).toBe('in-1')
    expect(port?.outputID).toBe('out-1')
    expect(port?.displayName).toBe('K-Board')
    expect(port?.manufacturer).toBe('kesumo-llc')
  })

  it('includes input-only and output-only ports', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'Only Input', type: 'input' },
      { id: 'out-1', name: 'Only Output', type: 'output' },
    ])
    const ports = buildPorts(midi.access, new Map())
    expect(ports.get('only-input')?.inputID).toBe('in-1')
    expect(ports.get('only-input')?.outputID).toBeUndefined()
    expect(ports.get('only-output')?.outputID).toBe('out-1')
    expect(ports.get('only-output')?.inputID).toBeUndefined()
  })

  it('reuses metadata objects from the store, keyed by name', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const store = new Map<string, Record<string, unknown>>([['k-board', { quality: 'great' }]])
    const ports = buildPorts(midi.access, store)
    expect(ports.get('k-board')?.meta).toEqual({ quality: 'great' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/build-ports.test.ts`
Expected: FAIL — cannot resolve `../src/build-ports.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/build-ports.ts`:

```ts
import { normalize } from './normalize.js'
import { createPort } from './port.js'
import type { Port } from './types.js'

interface Accumulated {
  displayName: string
  manufacturer: string
  inputID?: string
  outputID?: string
}

/**
 * Builds a name-keyed map of ports from an MIDIAccess object, merging an input
 * and output that share a normalized name into a single Port. Metadata records
 * are taken from (and written back into) the provided store so they survive
 * rebuilds/reconnects.
 */
export function buildPorts(
  access: MIDIAccess,
  metaStore: Map<string, Record<string, unknown>>,
): Map<string, Port> {
  const accumulated = new Map<string, Accumulated>()

  const collect = (device: MIDIInput | MIDIOutput, kind: 'input' | 'output'): void => {
    const name = normalize(device.name ?? '')
    const entry: Accumulated = accumulated.get(name) ?? {
      displayName: device.name ?? '',
      manufacturer: normalize(device.manufacturer ?? ''),
    }
    if (kind === 'input') entry.inputID = device.id
    else entry.outputID = device.id
    accumulated.set(name, entry)
  }

  for (const input of access.inputs.values()) collect(input, 'input')
  for (const output of access.outputs.values()) collect(output, 'output')

  const ports = new Map<string, Port>()
  for (const [name, entry] of accumulated) {
    const meta = metaStore.get(name) ?? {}
    metaStore.set(name, meta)
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
      }),
    )
  }

  return ports
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/build-ports.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/build-ports.ts test/build-ports.test.ts
git commit -m "feat: build ports from MIDIAccess (merge input+output by name)"
```

---

## Task 7: Device handle

**Files:**
- Create: `src/device.ts`
- Test: `test/device.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/device.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createDevice } from '../src/device.js'
import { createPort } from '../src/port.js'
import { createMockMidi } from './helpers/mock-midi.js'

function samplePort(name: string) {
  const midi = createMockMidi()
  return createPort({
    name,
    displayName: name,
    manufacturer: '',
    access: midi.access,
    meta: {},
  })
}

describe('createDevice', () => {
  it('looks up member ports by name', () => {
    const port = samplePort('k-board')
    const device = createDevice({
      name: 'k-board',
      ports: new Map([['k-board', port]]),
      meta: {},
    })
    expect(device.name).toBe('k-board')
    expect(device.get('k-board')).toBe(port)
    expect(device.get('missing')).toBeUndefined()
    expect(device.ports.size).toBe(1)
  })

  it('set() writes device metadata, is chainable, and survives via the shared store', () => {
    const meta: Record<string, unknown> = { icon: 'k.svg' }
    const device = createDevice({ name: 'k-mix', ports: new Map(), meta })
    expect(device.set('label', 'My Mixer')).toBe(device)
    expect(device.meta).toEqual({ icon: 'k.svg', label: 'My Mixer' })
    expect(meta).toEqual({ icon: 'k.svg', label: 'My Mixer' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/device.test.ts`
Expected: FAIL — cannot resolve `../src/device.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/device.ts`:

```ts
import type { Device, Port } from './types.js'

export interface CreateDeviceParams {
  name: string
  ports: Map<string, Port>
  /** Shared metadata record (owned by the factory's per-device store). */
  meta: Record<string, unknown>
}

export function createDevice(params: CreateDeviceParams): Device {
  const { name, ports, meta } = params

  const device: Device = {
    name,
    ports,
    get meta() {
      return meta
    },
    get(portName) {
      return ports.get(portName)
    },
    set(key, value) {
      meta[key] = value
      return this
    },
  }

  return device
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/device.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/device.ts test/device.test.ts
git commit -m "feat: add Device handle"
```

---

## Task 8: Build devices & not-found from config

**Files:**
- Create: `src/build-devices.ts`
- Test: `test/build-devices.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/build-devices.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildPorts } from '../src/build-ports.js'
import { buildDevices } from '../src/build-devices.js'
import { createMockMidi } from './helpers/mock-midi.js'
import type { DevicesConfig } from '../src/types.js'

const config: DevicesConfig = {
  'k-mix': {
    ports: ['k-mix-audio-control', 'k-mix-control-surface'],
    meta: { icon: 'k-mix.svg' },
  },
  'k-board': { ports: ['k-board'] },
}

describe('buildDevices', () => {
  it('groups connected ports and seeds device metadata from config', () => {
    const midi = createMockMidi([
      { id: 'in-1', name: 'K-Mix Audio Control', type: 'input' },
      { id: 'in-2', name: 'K-Mix Control Surface', type: 'input' },
      { id: 'in-3', name: 'K-Board', type: 'input' },
    ])
    const ports = buildPorts(midi.access, new Map())
    const { devices, notFound } = buildDevices(config, ports, new Map())

    expect(notFound).toEqual([])
    expect(devices.get('k-mix')?.ports.size).toBe(2)
    expect(devices.get('k-mix')?.get('k-mix-audio-control')?.inputID).toBe('in-1')
    expect(devices.get('k-mix')?.meta).toEqual({ icon: 'k-mix.svg' })
  })

  it('reports expected-but-missing ports in notFound', () => {
    const midi = createMockMidi([{ id: 'in-3', name: 'K-Board', type: 'input' }])
    const ports = buildPorts(midi.access, new Map())
    const { devices, notFound } = buildDevices(config, ports, new Map())

    expect(notFound).toEqual(['k-mix-audio-control', 'k-mix-control-surface'])
    expect(devices.get('k-mix')?.ports.size).toBe(0)
    expect(devices.get('k-board')?.get('k-board')?.inputID).toBe('in-3')
  })

  it('reuses device metadata objects from the store across rebuilds', () => {
    const midi = createMockMidi([{ id: 'in-3', name: 'K-Board', type: 'input' }])
    const ports = buildPorts(midi.access, new Map())
    const store = new Map<string, Record<string, unknown>>()

    const first = buildDevices(config, ports, store)
    first.devices.get('k-board')?.set('label', 'mine')
    const second = buildDevices(config, ports, store)

    expect(second.devices.get('k-board')?.meta).toEqual({ label: 'mine' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/build-devices.test.ts`
Expected: FAIL — cannot resolve `../src/build-devices.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/build-devices.ts`:

```ts
import { createDevice } from './device.js'
import type { Device, DevicesConfig, Port } from './types.js'

export interface BuiltDevices {
  devices: Map<string, Device>
  notFound: string[]
}

/**
 * Groups built ports into named devices from a config. Any expected port name
 * not present in `ports` is collected into `notFound`. Device metadata is taken
 * from (and written back into) `deviceMetaStore`, seeded once from config.meta,
 * so user-set metadata survives rebuilds/reconnects.
 */
export function buildDevices(
  config: DevicesConfig,
  ports: ReadonlyMap<string, Port>,
  deviceMetaStore: Map<string, Record<string, unknown>>,
): BuiltDevices {
  const devices = new Map<string, Device>()
  const notFound: string[] = []

  for (const [deviceName, deviceConfig] of Object.entries(config)) {
    let meta = deviceMetaStore.get(deviceName)
    if (!meta) {
      meta = { ...(deviceConfig.meta ?? {}) }
      deviceMetaStore.set(deviceName, meta)
    }

    const memberPorts = new Map<string, Port>()
    for (const portName of deviceConfig.ports) {
      const port = ports.get(portName)
      if (port) memberPorts.set(portName, port)
      else notFound.push(portName)
    }

    devices.set(deviceName, createDevice({ name: deviceName, ports: memberPorts, meta }))
  }

  return { devices, notFound }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/build-devices.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/build-devices.ts test/build-devices.test.ts
git commit -m "feat: group ports into devices and track not-found"
```

---

## Task 9: Typed event emitter

**Files:**
- Create: `src/events.ts`

(Exercised through the factory tests in Task 10; a tiny direct test is included here to keep it self-contained.)

- [ ] **Step 1: Write the failing test**

Create `test/events.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createEmitter } from '../src/events.js'

describe('createEmitter', () => {
  it('calls handlers registered for an event and returns an unsubscribe fn', () => {
    const emitter = createEmitter()
    const handler = vi.fn()
    const unsubscribe = emitter.on('connect', handler)

    emitter.emit('connect', { type: 'connect' } as never)
    expect(handler).toHaveBeenCalledTimes(1)

    unsubscribe()
    emitter.emit('connect', { type: 'connect' } as never)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('off() removes a handler and clear() removes all', () => {
    const emitter = createEmitter()
    const a = vi.fn()
    const b = vi.fn()
    emitter.on('statechange', a)
    emitter.on('statechange', b)

    emitter.off('statechange', a)
    emitter.emit('statechange', {} as never)
    expect(a).not.toHaveBeenCalled()
    expect(b).toHaveBeenCalledTimes(1)

    emitter.clear()
    emitter.emit('statechange', {} as never)
    expect(b).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/events.test.ts`
Expected: FAIL — cannot resolve `../src/events.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/events.ts`:

```ts
import type { MidiPortEvent, MidiPortEventType } from './types.js'

type Handler = (event: MidiPortEvent) => void

export interface Emitter {
  on(type: MidiPortEventType, handler: Handler): () => void
  off(type: MidiPortEventType, handler: Handler): void
  emit(type: MidiPortEventType, event: MidiPortEvent): void
  clear(): void
}

export function createEmitter(): Emitter {
  const handlers = new Map<MidiPortEventType, Set<Handler>>()

  return {
    on(type, handler) {
      const set = handlers.get(type) ?? new Set<Handler>()
      set.add(handler)
      handlers.set(type, set)
      return () => this.off(type, handler)
    },
    off(type, handler) {
      handlers.get(type)?.delete(handler)
    },
    emit(type, event) {
      const set = handlers.get(type)
      if (!set) return
      for (const handler of set) handler(event)
    },
    clear() {
      handlers.clear()
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/events.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/events.ts test/events.test.ts
git commit -m "feat: add typed event emitter"
```

---

## Task 10: Factory (createMidiPorts / requestMidiPorts) with hot-plug

**Files:**
- Create: `src/factory.ts`
- Test: `test/factory.test.ts`

- [ ] **Step 1: Write the failing test**

Create `test/factory.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { createMidiPorts, requestMidiPorts } from '../src/factory.js'
import { MidiUnsupportedError } from '../src/errors.js'
import { createMockMidi } from './helpers/mock-midi.js'
import type { DevicesConfig } from '../src/types.js'

const config: DevicesConfig = {
  'k-mix': { ports: ['k-mix-audio-control', 'k-mix-control-surface'] },
}

describe('createMidiPorts', () => {
  it('exposes ports, get(), and access', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    expect(mp.access).toBe(midi.access)
    expect(mp.get('k-board')?.inputID).toBe('in-1')
    expect(mp.ports.size).toBe(1)
  })

  it('builds devices and notFound from config', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Mix Audio Control', type: 'input' }])
    const mp = createMidiPorts(midi.access, { devices: config })
    expect(mp.device('k-mix')?.get('k-mix-audio-control')?.inputID).toBe('in-1')
    expect(mp.notFound).toEqual(['k-mix-control-surface'])
  })

  it('emits connect and updates ports/notFound on hot-plug', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Mix Audio Control', type: 'input' }])
    const mp = createMidiPorts(midi.access, { devices: config })
    const onConnect = vi.fn()
    const onState = vi.fn()
    mp.on('connect', onConnect)
    mp.on('statechange', onState)

    midi.connect({ id: 'in-2', name: 'K-Mix Control Surface', type: 'input' })

    expect(mp.get('k-mix-control-surface')?.inputID).toBe('in-2')
    expect(mp.notFound).toEqual([])
    expect(onConnect).toHaveBeenCalledTimes(1)
    expect(onConnect.mock.calls[0][0].type).toBe('connect')
    expect(onConnect.mock.calls[0][0].port.name).toBe('k-mix-control-surface')
    expect(onState).toHaveBeenCalledTimes(1)
  })

  it('emits disconnect and removes the port on unplug', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    const onDisconnect = vi.fn()
    mp.on('disconnect', onDisconnect)

    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(mp.get('k-board')).toBeUndefined()
    expect(onDisconnect).toHaveBeenCalledTimes(1)
    expect(onDisconnect.mock.calls[0][0].port.name).toBe('k-board')
  })

  it('preserves custom metadata across a disconnect/reconnect', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    mp.get('k-board')?.set('quality', 'great')

    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })
    midi.connect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(mp.get('k-board')?.meta).toEqual({ quality: 'great' })
  })

  it('dispose() detaches the listener so no further events fire', () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const mp = createMidiPorts(midi.access)
    const onState = vi.fn()
    mp.on('statechange', onState)

    mp.dispose()
    midi.disconnect({ id: 'in-1', name: 'K-Board', type: 'input' })

    expect(onState).not.toHaveBeenCalled()
  })
})

describe('requestMidiPorts', () => {
  it('throws MidiUnsupportedError when Web MIDI is unavailable', async () => {
    const original = globalThis.navigator
    // @ts-expect-error — simulate an environment without requestMIDIAccess
    globalThis.navigator = {}
    await expect(requestMidiPorts()).rejects.toBeInstanceOf(MidiUnsupportedError)
    // @ts-expect-error — restore
    globalThis.navigator = original
  })

  it('wraps the access returned by navigator.requestMIDIAccess', async () => {
    const midi = createMockMidi([{ id: 'in-1', name: 'K-Board', type: 'input' }])
    const original = globalThis.navigator
    // @ts-expect-error — inject a fake navigator
    globalThis.navigator = { requestMIDIAccess: vi.fn().mockResolvedValue(midi.access) }

    const mp = await requestMidiPorts({ sysex: true })
    expect(mp.get('k-board')?.inputID).toBe('in-1')

    // @ts-expect-error — restore
    globalThis.navigator = original
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run test/factory.test.ts`
Expected: FAIL — cannot resolve `../src/factory.js`.

- [ ] **Step 3: Write minimal implementation**

Create `src/factory.ts`:

```ts
import { buildDevices } from './build-devices.js'
import { buildPorts } from './build-ports.js'
import { MidiUnsupportedError } from './errors.js'
import { createEmitter } from './events.js'
import { normalize } from './normalize.js'
import type { Device, MidiPorts, MidiPortsOptions, Port } from './types.js'

/** Wraps an existing MIDIAccess object. */
export function createMidiPorts(access: MIDIAccess, options: MidiPortsOptions = {}): MidiPorts {
  const config = options.devices ?? {}
  const metaStore = new Map<string, Record<string, unknown>>()
  const deviceMetaStore = new Map<string, Record<string, unknown>>()
  const emitter = createEmitter()

  let ports: Map<string, Port> = buildPorts(access, metaStore)
  let devices: Map<string, Device>
  let notFound: string[]

  const rebuild = (): void => {
    ports = buildPorts(access, metaStore)
    const built = buildDevices(config, ports, deviceMetaStore)
    devices = built.devices
    notFound = built.notFound
  }

  const initial = buildDevices(config, ports, deviceMetaStore)
  devices = initial.devices
  notFound = initial.notFound

  const handleStateChange = (raw: MIDIConnectionEvent): void => {
    const changed = raw.port
    if (!changed) return
    const name = normalize(changed.name ?? '')

    const previous = ports.get(name)
    rebuild()
    const current = ports.get(name)

    if (!previous && current) {
      emitter.emit('connect', { type: 'connect', port: current, raw })
    } else if (previous && !current) {
      emitter.emit('disconnect', { type: 'disconnect', port: previous, raw })
    }

    const isConnected = changed.state === 'connected'
    const port = current ?? previous
    if (port) {
      emitter.emit('statechange', {
        type: isConnected ? 'connect' : 'disconnect',
        port,
        raw,
      })
    }
  }

  access.addEventListener('statechange', handleStateChange)

  return {
    access,
    get ports() {
      return ports
    },
    get devices() {
      return devices
    },
    get notFound() {
      return notFound
    },
    get(name) {
      return ports.get(name)
    },
    device(name) {
      return devices.get(name)
    },
    on(event, handler) {
      return emitter.on(event, handler)
    },
    off(event, handler) {
      emitter.off(event, handler)
    },
    dispose() {
      access.removeEventListener('statechange', handleStateChange)
      emitter.clear()
    },
  }
}

/** Requests Web MIDI access, then wraps it. */
export async function requestMidiPorts(options: MidiPortsOptions = {}): Promise<MidiPorts> {
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    throw new MidiUnsupportedError()
  }
  const access = await navigator.requestMIDIAccess({
    sysex: options.sysex,
    software: options.software,
  })
  return createMidiPorts(access, options)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run test/factory.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/factory.ts test/factory.test.ts
git commit -m "feat: add factory with hot-plug events and dispose"
```

---

## Task 11: Public entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Create `src/index.ts`**

```ts
export { createMidiPorts, requestMidiPorts } from './factory.js'
export { MidiUnsupportedError } from './errors.js'
export type {
  Device,
  DevicesConfig,
  MidiPortEvent,
  MidiPortEventType,
  MidiPorts,
  MidiPortsOptions,
  Port,
} from './types.js'
```

- [ ] **Step 2: Typecheck, lint, full test run, and build**

Run:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

Expected:
- `typecheck`: exits 0.
- `lint`: Biome reports no errors (run `pnpm run format` then re-run `lint` if it flags formatting).
- `test`: all suites pass (normalize, build-ports, port, device, build-devices, events, factory).
- `build`: tsup writes `dist/index.js`, `dist/index.js.map`, and `dist/index.d.ts`.

- [ ] **Step 3: Verify the built package exports resolve**

Run:

```bash
node --input-type=module -e "import('./dist/index.js').then(m => console.log(Object.keys(m).sort().join(',')))"
```

Expected output: `MidiUnsupportedError,createMidiPorts,requestMidiPorts`

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add public entry point"
```

---

## Task 12: README rewrite + migration guide

**Files:**
- Modify: `README.md` (full replace)

- [ ] **Step 1: Replace `README.md`**

```markdown
# midi-ports

Type-safe [Web MIDI](https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API) helper. Wrap an `MIDIAccess` object and access input/output ports **by name** — with grouped devices, not-found tracking, custom metadata, and hot-plug events.

> Browser support: https://caniuse.com/midi

## Install

```bash
npm install midi-ports
```

## Quick start

```ts
import { requestMidiPorts } from 'midi-ports'

const midi = await requestMidiPorts({ sysex: true })

const port = midi.get('k-mix-control-surface')
port?.input?.addEventListener('midimessage', (e) => console.log('data', e.data))
port?.output?.send([176, 1, 64])
```

If you already have an `MIDIAccess` object, use `createMidiPorts(access, options)` instead.

## Ports

`midi.ports` is a `ReadonlyMap<string, Port>` of every connected port, keyed by a normalized name (lowercased, spaces → hyphens, commas removed). An input and an output that share a name are merged into one `Port`.

```ts
for (const port of midi.ports.values()) {
  console.log(port.name, port.displayName, port.manufacturer)
}

const port = midi.get('k-board')
port?.input          // live MIDIInput | undefined
port?.output         // live MIDIOutput | undefined
port?.isConnected    // boolean
port?.send([144, 60, 127])   // convenience → output.send; throws if no output
```

## Grouped devices

Pass a `devices` config to group ports under named devices:

```ts
const midi = createMidiPorts(access, {
  devices: {
    'k-mix': {
      ports: ['k-mix-audio-control', 'k-mix-control-surface'],
      meta: { icon: 'k-mix.svg', manufacturer: 'Keith McMillen Instruments' },
    },
    'k-board': { ports: ['k-board'] },
  },
})

midi.device('k-mix')?.get('k-mix-audio-control')?.output?.send([240, 126, 127, 6, 1, 247])
midi.device('k-mix')?.meta.icon   // 'k-mix.svg'
```

## Not-found tracking

Any port named in a device config that isn't connected is listed in `midi.notFound`, so you can build fallback UI:

```ts
if (midi.notFound.length) {
  console.warn('missing ports:', midi.notFound)
  // e.g. let the user pick an alternative from midi.ports
}
```

## Custom metadata

Attach arbitrary data to a port or device. It survives disconnect/reconnect.

```ts
midi.get('k-board')?.set('quality', 'great').set('price', 99)
midi.get('k-board')?.meta // { quality: 'great', price: 99 }
```

## Hot-plug events

`midi.ports`, `midi.devices`, and `midi.notFound` stay live as devices are plugged/unplugged. Subscribe to react:

```ts
const off = midi.on('connect', ({ port }) => console.log('connected', port.name))
midi.on('disconnect', ({ port }) => console.log('disconnected', port.name))
midi.on('statechange', ({ type, port }) => console.log(type, port.name))

off()            // unsubscribe a single handler
midi.dispose()   // detach everything when you're done
```

## API

- `requestMidiPorts(options?)` → `Promise<MidiPorts>` — requests access, then wraps it. Throws `MidiUnsupportedError` if Web MIDI is unavailable.
- `createMidiPorts(access, options?)` → `MidiPorts` — wraps an existing `MIDIAccess`.
- `MidiPorts`: `access`, `ports`, `devices`, `notFound`, `get(name)`, `device(name)`, `on(event, handler)`, `off(event, handler)`, `dispose()`.
- `Port`: `name`, `displayName`, `manufacturer`, `inputID?`, `outputID?`, `input?`, `output?`, `isConnected`, `meta`, `send(data, timestamp?)`, `set(key, value)`.
- `Device`: `name`, `ports`, `meta`, `get(portName)`, `set(key, value)`.

## Migrating from v2

v3 is a full rewrite with a new, type-safe API. The old stringly-typed callable is gone.

| v2 | v3 |
| --- | --- |
| `const ports = midiPorts(midi)` | `const midi = createMidiPorts(access)` |
| `ports('ports')` | `midi.ports` (a `Map`) |
| `ports('devices')` | `midi.devices` (a `Map`) |
| `ports('access')` | `midi.access` |
| `ports('notfound')` | `midi.notFound` (`string[]`, empty if none) |
| `ports('k-board').get('input')` | `midi.get('k-board')?.input` |
| `ports('k-board').get('output')` | `midi.get('k-board')?.output` |
| `ports('k-mix:audio-control').get('output')` | `midi.device('k-mix')?.get('audio-control')?.output` |
| `ports('k-board').set('q', 'great').get('q')` | `midi.get('k-board')?.set('q', 'great').meta.q` |
| second-arg grouped object with empty `{}` port keys | `devices` config: `{ name: { ports: [...], meta: {} } }` |
| `midi.onstatechange = ...` (manual) | `midi.on('connect' | 'disconnect' | 'statechange', handler)` |

## License

MIT
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for v3 API with migration guide"
```

---

## Task 13: CI, release automation, and changesets

**Files:**
- Create: `.changeset/config.json`, `.github/workflows/ci.yml`, `.github/workflows/release.yml`

- [ ] **Step 1: Create `.changeset/config.json`**

```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.0.0/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "master",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 2: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm run lint
      - run: pnpm run typecheck
      - run: pnpm run test
      - run: pnpm run build
```

- [ ] **Step 3: Create `.github/workflows/release.yml`**

```yaml
name: Release

on:
  push:
    branches: [master]

concurrency: release-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9.15.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org
      - run: pnpm install --frozen-lockfile
      - run: pnpm run build
      - uses: changesets/action@v1
        with:
          publish: pnpm run release
          version: pnpm exec changeset version
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 4: Add an initial changeset for the v3 release**

Create `.changeset/v3-rewrite.md`:

```markdown
---
'midi-ports': major
---

v3.0.0: complete TypeScript/ESM rewrite. New factory + Port-handle API (`createMidiPorts` / `requestMidiPorts`), grouped devices via a `devices` config, `notFound` tracking, per-port/device metadata that survives reconnects, and hot-plug `connect`/`disconnect`/`statechange` events. The v2 stringly-typed callable API is removed — see the README migration guide.
```

> Note: `package.json` is already set to `3.0.0`. This changeset documents the major bump for the changelog; on the first automated release run, confirm Changesets does not double-bump (if it proposes `4.0.0`, reset `version` to `2.1.0` before merging the release PR so `changeset version` produces `3.0.0`, or delete this changeset and tag `3.0.0` manually).

- [ ] **Step 5: Verify changesets status runs**

Run:

```bash
pnpm exec changeset status
```

Expected: reports `midi-ports` with a `major` bump pending. (If it errors about the base branch, ensure the repo's default branch is `master`.)

- [ ] **Step 6: Commit**

```bash
git add .changeset .github
git commit -m "ci: add GitHub Actions CI and Changesets release automation"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run the full pipeline exactly as CI will**

Run:

```bash
cd ~/code/midi-ports
pnpm install --frozen-lockfile
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

Expected: every command exits 0; all test suites pass; `dist/` contains `index.js`, `index.js.map`, `index.d.ts`.

- [ ] **Step 2: Confirm coverage is meaningful**

Run: `pnpm run coverage`
Expected: `src/` files report high coverage (the factory, port, device, build-* and normalize modules should all be exercised). Investigate any file under ~80%.

- [ ] **Step 3: Confirm the working tree is clean and history is tidy**

Run: `git status` (expect clean) and `git log --oneline -15` (expect the per-task commits above on top of the spec commit).

---

## Self-Review (completed during planning)

- **Spec coverage:** factory/Port API (Tasks 5, 10, 11), devices config (Task 8), normalization (Task 3), hot-plug + metadata persistence (Task 10), errors (Tasks 4, 10), internal module layout (Tasks 3–11 match the spec's `src/` list), testing strategy + mock (Tasks 2–10), tooling/build/CI/release (Tasks 1, 13), README + migration (Task 12). All spec sections map to a task.
- **Type consistency:** `createPort`/`createDevice` param shapes, `buildPorts(access, metaStore)`, `buildDevices(config, ports, deviceMetaStore)`, and the `MidiPorts`/`Port`/`Device` interfaces are referenced identically across tasks. Metadata stores are `Map<string, Record<string, unknown>>` everywhere.
- **Placeholders:** none — every code/test step contains complete content.
```
