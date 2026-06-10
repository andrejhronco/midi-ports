---
'midi-ports': minor
---

`MidiPorts.get(name)` and `Device.get(portName)` now normalize their argument, so the raw device/port name resolves the same as the normalized key — `midi.get('K Board')` works just like `midi.get('k-board')`. Existing normalized lookups are unaffected (normalization is idempotent).
