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

`midi.ports`, `midi.devices`, and `midi.notFound` stay live as devices are plugged and unplugged. Subscribe to react:

```ts
const off = midi.on('connect', ({ port }) => console.log('connected', port.name))
midi.on('disconnect', ({ port }) => console.log('disconnected', port.name))
midi.on('statechange', ({ type, port }) => console.log(type, port.name))

off()            // unsubscribe a single handler
midi.dispose()   // detach everything when you're done
```

Event semantics (the `type` on each event payload):

- **`connect`** — fires once when a port name first appears. Because a MIDI device exposes its input and output as separate ports, a port may arrive input-only (or output-only); check `port.input` / `port.output` / `port.isConnected` rather than assuming both are present.
- **`disconnect`** — fires once when a port name fully goes away.
- **`change`** — delivered on the `statechange` channel only, when a still-present port gains or loses a half (e.g. an input-only port gains its output).

The `connect` channel receives only `connect` events, the `disconnect` channel only `disconnect` events, and the `statechange` channel receives all three (`connect`, `disconnect`, and `change`).

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
| `midi.onstatechange = ...` (manual) | `midi.on('connect' \| 'disconnect' \| 'statechange', handler)` |

## License

MIT
