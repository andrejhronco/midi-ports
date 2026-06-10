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
