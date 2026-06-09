/**
 * Vitest global setup: ensure `globalThis.navigator` is a configurable,
 * writable property so tests can assign fakes via `globalThis.navigator = …`.
 *
 * Node >=22 ships a getter-only `navigator` on `globalThis`; direct assignment
 * throws in ESM strict mode. `Object.defineProperty` with `configurable: true`
 * and `writable: true` lets test code override it freely.
 */
const navDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
if (navDescriptor && !navDescriptor.writable && !navDescriptor.set) {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: navDescriptor.get ? navDescriptor.get.call(globalThis) : navDescriptor.value,
  })
}
