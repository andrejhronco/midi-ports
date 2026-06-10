import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Port } from '../src/types.js'
import { MidiTimeoutError, waitForPort } from '../src/wait.js'

const present = { isConnected: true, input: {}, output: {} } as never
const inputOnly = { isConnected: true, input: {}, output: undefined } as never

describe('waitForPort', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('resolves immediately when the port is already present', async () => {
    const port = await waitForPort(
      () => present,
      () => () => {},
      {},
    )
    expect(port).toBe(present)
  })

  it('resolves when a later statechange satisfies the condition', async () => {
    let current: Port | undefined
    let cb = () => {}
    const promise = waitForPort(
      () => current,
      (fn) => {
        cb = fn
        return () => {}
      },
      {},
    )
    current = present
    cb()
    await expect(promise).resolves.toBe(present)
  })

  it('requireBoth waits for input and output', async () => {
    let current: Port | undefined = inputOnly
    let cb = () => {}
    const promise = waitForPort(
      () => current,
      (fn) => {
        cb = fn
        return () => {}
      },
      { requireBoth: true },
    )
    cb() // still input-only, should not resolve
    current = present
    cb()
    await expect(promise).resolves.toBe(present)
  })

  it('rejects with MidiTimeoutError after the timeout', async () => {
    const promise = waitForPort(
      () => undefined,
      () => () => {},
      { timeout: 1000 },
    )
    const assertion = expect(promise).rejects.toBeInstanceOf(MidiTimeoutError)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
  })

  it('rejects when the signal aborts', async () => {
    const controller = new AbortController()
    const promise = waitForPort(
      () => undefined,
      () => () => {},
      { signal: controller.signal },
    )
    controller.abort(new Error('cancelled'))
    await expect(promise).rejects.toThrow('cancelled')
  })
})
