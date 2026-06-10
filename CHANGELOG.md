# midi-ports

## 3.0.0

### Major Changes

- 13589eb: v3.0.0: complete TypeScript/ESM rewrite. New factory + Port-handle API (`createMidiPorts` / `requestMidiPorts`), grouped devices via a `devices` config, `notFound` tracking, per-port/device metadata that survives reconnects, and hot-plug `connect`/`disconnect`/`statechange` events. The v2 stringly-typed callable API is removed — see the README migration guide.
