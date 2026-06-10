---
'midi-ports': patch
---

Docs: add a "Using with webmidi.js" guide that frames midi-ports as the device/port topology layer and webmidi.js as the MIDI messaging layer, with a type-checked example of the two composed. The demo (`demo/index.html`) now shows the same split live — midi-ports lists ports and tracks hot-plug, webmidi.js plays a note and parses incoming messages.
