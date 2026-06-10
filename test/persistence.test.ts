import { describe, expect, it } from 'vitest'
import { createPersistController } from '../src/persistence.js'

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    _map: map,
  }
}

describe('createPersistController', () => {
  it('loads an empty doc when nothing is stored', () => {
    const ctrl = createPersistController({ key: 'k', storage: memoryStorage() })
    expect(ctrl.load()).toEqual({})
  })

  it('round-trips a saved document (coalesced)', async () => {
    const storage = memoryStorage()
    const ctrl = createPersistController({ key: 'k', storage })
    ctrl.save({ ports: { 'k-board': { color: 'red' } } })
    ctrl.save({ ports: { 'k-board': { color: 'blue' } } })
    await Promise.resolve()
    expect(JSON.parse(storage._map.get('k') as string)).toEqual({
      ports: { 'k-board': { color: 'blue' } },
    })
  })

  it('degrades gracefully when storage throws', async () => {
    const throwing = {
      getItem: () => {
        throw new Error('boom')
      },
      setItem: () => {
        throw new Error('boom')
      },
      removeItem: () => {},
    }
    const ctrl = createPersistController({ key: 'k', storage: throwing })
    expect(ctrl.load()).toEqual({})
    ctrl.save({ roles: { a: 'b' } })
    await Promise.resolve()
    // no throw == pass
  })
})
