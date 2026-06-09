# midi-ports v3 — Redesign Design Spec

**Date:** 2026-06-09
**Status:** Approved (pending spec review)
**Scope:** Complete v3.0.0 rewrite of the `midi-ports` npm package — architecture, public API, types, tests, and dev tooling.

## Background

`midi-ports` (currently v2.1.0) is a small browser library that wraps the Web MIDI API's `MIDIAccess` object and builds a name-keyed map of MIDI ports (`name`, `inputID`, `outputID`, `manufacturer`) for more semantic device access.

The existing implementation is a single CommonJS `index.js`: mixed `var`/`let` ES5, no types, no tests, no build or lint tooling, and an unusual stringly-typed callable API (`ports('device').get(...)` / `.set(...)` with magic string args like `'access'`, `'ports'`, `'notfound'`, `'device:port'`). It is hard to read, hard to type, and easy to misuse.

## Goals

- Clean, idiomatic, **type-safe** public API (no behavioral back-compat required — this is a major version).
- Modern toolchain: TypeScript, ESM-only distribution, fast lint/format/test, CI, and release automation.
- Small, single-purpose, independently testable internal modules.
- Preserve the useful capabilities of v2 (name lookup, grouped devices, not-found tracking, custom metadata) and add live hot-plug support.

## Non-Goals

- No CommonJS or UMD build — **ESM-only**.
- No runtime dependencies.
- No MIDI message parsing/encoding helpers beyond a thin `send` convenience.
- No backward-compatible shim for the v2 callable API.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| API compatibility | Redesign freely as v3.0.0 (breaking) |
| Language / types | TypeScript, ship compiled ESM + `.d.ts` |
| Module format | ESM-only |
| Construction style | Factory functions (no `new`) |
| Port access | `Port` handles with live `.input` / `.output` getters |
| Features kept | Grouped devices, not-found tracking, custom metadata |
| New feature | Hot-plug connect/disconnect events |
| Lint + format / test | Biome + Vitest |
| Build | tsup (ESM + `.d.ts`) |
| CI / release | GitHub Actions CI + Changesets release automation |
| Package manager | pnpm |
| `port.send` with no output | Throws (escape hatch: `port.output?.send(...)`) |
| Metadata access | Write via chainable `.set(k, v)`, read via `.meta` bag |

## Public API

### Construction (factory)

```ts
// Requests MIDI access, then wraps it.
const midi = await requestMidiPorts({ sysex: true, devices });

// …or wrap an MIDIAccess you already obtained.
const midi = createMidiPorts(access, { devices });
```

```ts
interface MidiPortsOptions {
  /** Only used by requestMidiPorts → navigator.requestMIDIAccess({ sysex }). */
  sysex?: boolean;
  /** Only used by requestMidiPorts → navigator.requestMIDIAccess({ software }). */
  software?: boolean;
  /** Optional device-grouping config (see "devices config"). */
  devices?: DevicesConfig;
}
```

### The `midi` object

A plain typed object literal (no class on the outside).

```ts
interface MidiPorts {
  readonly access: MIDIAccess;
  /** ALL currently-connected ports, keyed by normalized name. */
  readonly ports: ReadonlyMap<string, Port>;
  /** Grouped devices (empty unless `devices` config was provided). */
  readonly devices: ReadonlyMap<string, Device>;
  /** Expected port names (from config) not currently connected. */
  readonly notFound: string[];

  get(name: string): Port | undefined;
  device(name: string): Device | undefined;

  /** Subscribe; returns an unsubscribe function. */
  on(event: MidiPortEventType, handler: (e: MidiPortEvent) => void): () => void;
  off(event: MidiPortEventType, handler: (e: MidiPortEvent) => void): void;

  /** Detach the underlying statechange listener and clear subscribers. */
  dispose(): void;
}
```

### `Port` handle

```ts
interface Port {
  /** Normalized key, e.g. 'k-mix-control-surface'. */
  readonly name: string;
  /** Original device name, e.g. 'K-Mix Control Surface'. */
  readonly displayName: string;
  /** Normalized manufacturer string. */
  readonly manufacturer: string;
  readonly inputID?: string;
  readonly outputID?: string;
  /** Live getter → access.inputs.get(inputID). */
  readonly input?: MIDIInput;
  /** Live getter → access.outputs.get(outputID). */
  readonly output?: MIDIOutput;
  readonly isConnected: boolean;

  /** Convenience → output.send(data, timestamp). Throws if no output. Chainable. */
  send(data: number[] | Uint8Array, timestamp?: number): this;

  /** Set arbitrary metadata. Chainable. */
  set(key: string, value: unknown): this;
  /** Read-only view of all metadata for this port. */
  readonly meta: Readonly<Record<string, unknown>>;
}
```

### `Device` handle

```ts
interface Device {
  readonly name: string;
  readonly ports: ReadonlyMap<string, Port>;
  get(portName: string): Port | undefined;

  set(key: string, value: unknown): this;
  readonly meta: Readonly<Record<string, unknown>>;
}
```

### Events

```ts
type MidiPortEventType = 'connect' | 'disconnect' | 'statechange';

interface MidiPortEvent {
  type: 'connect' | 'disconnect';
  /** The affected Port handle. */
  port: Port;
  /** The raw browser event. */
  raw: MIDIConnectionEvent;
}
```

## `devices` config

The v2 grouped format mixed port-name keys with metadata keys in one object, which was ambiguous. v3 separates them explicitly:

```ts
interface DevicesConfig {
  [deviceName: string]: {
    /** Expected normalized port names belonging to this device. */
    ports: string[];
    /** Optional device-level metadata (icon, manufacturer, etc.). */
    meta?: Record<string, unknown>;
  };
}
```

Example:

```ts
const devices: DevicesConfig = {
  'k-mix': {
    ports: ['k-mix-audio-control', 'k-mix-control-surface'],
    meta: { icon: '…', manufacturer: 'Keith McMillen Instruments' },
  },
  'k-board': { ports: ['k-board'] },
};
```

- Any name in any `ports` array that is not currently connected is added to `midi.notFound`.
- Single same-named port shorthand is preserved: `midi.device('k-board')?.get('k-board')`.

## Behavior

### Name normalization

`normalize(name)` → lowercase, runs of whitespace collapsed to single `-`, commas stripped. Replaces the v2 `format()` helper. Used for port keys and manufacturer strings. `displayName` retains the original.

### Port building

`build-ports` iterates `access.inputs` and `access.outputs`, keying by normalized `name`. Inputs and outputs sharing a name merge into one `Port` (`inputID` + `outputID`). `input`/`output` are **live getters** that resolve against `MIDIAccess` on each access, so they return the current object after reconnects.

### Hot-plug

`createMidiPorts` attaches a handler to `access.onstatechange`:

- **Connect:** add or refresh the `Port` in `midi.ports`; attach it to its device if it was expected; remove it from `notFound`; emit `connect` then `statechange`.
- **Disconnect:** remove the `Port` from `midi.ports`; add it back to `notFound` if it was expected by config; emit `disconnect` then `statechange`.
- **Metadata survives reconnects:** custom metadata is held in an internal store keyed by normalized name (per-port and per-device), independent of the disposable `Port`/`Device` objects, so a reconnected port restores its metadata.
- `dispose()` removes the statechange handler and clears subscribers.

### Errors

- `requestMidiPorts` throws a typed `MidiUnsupportedError` when `navigator.requestMIDIAccess` is unavailable; permission/`SecurityError` rejections propagate as-is.
- `midi.get(name)` and `device.get(name)` return `undefined` on a miss (Map-like, no throw).
- `port.send` throws (descriptive `Error`) when the port has no output.

## Internal architecture

Small, single-purpose modules, each independently testable:

```
src/
  index.ts          # public exports + types only
  factory.ts        # createMidiPorts / requestMidiPorts, event wiring, dispose
  port.ts           # createPort → Port (live getters, send, metadata)
  device.ts         # createDevice → Device
  build-ports.ts    # MIDIAccess → Map<name, Port> (merges input+output by name)
  build-devices.ts  # DevicesConfig + ports → Map<name, Device> + notFound
  normalize.ts      # name normalization
  events.ts         # tiny typed emitter
  errors.ts         # MidiUnsupportedError and friends
  types.ts          # shared interfaces
```

Each unit answers: what it does, how it's used, and what it depends on — and can be understood without reading the others' internals.

## Testing strategy

- **Vitest**, node environment (no jsdom — Web MIDI is mocked).
- `test/helpers/mock-midi.ts`: constructs a fake `MIDIAccess` with `inputs`/`outputs` `Map`s of fake `MIDIInput`/`MIDIOutput` objects, and can fire `statechange` events on demand.
- Coverage (v8) for:
  - `normalize`: casing, whitespace, commas, edge cases.
  - `build-ports`: input/output merge by name; input-only / output-only ports.
  - `build-devices`: grouping, `notFound` population, single-port shorthand.
  - `Port`: live `input`/`output` getters, `isConnected`, `send` (success + throw-on-no-output), metadata chaining.
  - `Device`: lookup, metadata.
  - Hot-plug: connect adds + clears notFound + emits; disconnect removes + repopulates notFound + emits; metadata persists across reconnect.
  - Errors: unsupported environment, send without output.
  - `dispose`: detaches listener, stops emissions.

## Tooling & distribution

- **TypeScript**: `strict`, `target: ES2022`, `module: ESNext`, `moduleResolution: bundler`, `lib: [ES2022, DOM]` (for Web MIDI types via `@types/webmidi` or built-in DOM lib).
- **tsup**: entry `src/index.ts`, `format: esm`, `dts: true`, `sourcemap: true`, `treeshake: true`, `clean: true`.
- **package.json**:
  - `"type": "module"`, `"sideEffects": false`, `"files": ["dist"]`.
  - `exports`: `{ ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`.
  - `engines`: `node >= 18`.
  - Scripts: `build`, `dev` (tsup --watch), `test`, `test:watch`, `coverage`, `lint` (biome check), `format` (biome format --write), `typecheck` (tsc --noEmit), `prepublishOnly`.
  - Fix repo URL casing: `andrejhronco/midi-ports`.
- **Biome**: `biome.json` with formatter + linter + import organization enabled.
- **Changesets**: `.changeset/config.json` for versioning and changelog.
- **CI** (`.github/workflows/ci.yml`): pnpm install → `biome check` → `tsc --noEmit` → `vitest run` → `build`, on push/PR.
- **Release** (`.github/workflows/release.yml`): Changesets action to version + publish to npm.
- **`.gitignore`**: add `node_modules`, `dist`, `coverage`.

## Documentation

- README fully rewritten for the new API, with runnable examples for: request/create, port lookup + send/receive, grouped devices, not-found fallback, metadata, and hot-plug events.
- A **"Migrating from v2"** table mapping old callable usage to the new API.
- TSDoc comments on all public exports.

## Versioning & migration

- Ship as **v3.0.0** (breaking). MIT license retained.
- README migration section is the primary migration aid; no code shim is provided.
