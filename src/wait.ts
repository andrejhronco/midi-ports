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
