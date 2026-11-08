import type { EntryWrite, KidSnapshot, LedgerStore, LedgerTx, StoredEntry } from '../../app/lib/allowance-api/ledger'

export type MemoryKid = {
  id: string
  slug: string
  parentId: string
  total: number
  totalValid?: boolean
}

type MemoryEntry = {
  amount: number
  description: string
  calendarDate: string
  requestHash: string
}

export function memoryLedger(initial: MemoryKid[], options?: { failIncrement?: boolean; limit?: number }) {
  const kids: MemoryKid[] = initial.map((kid) => ({ totalValid: true, ...kid }))
  const entries = new Map<string, MemoryEntry>()

  const store: LedgerStore = {
    async runTransaction<T>(fn: (tx: LedgerTx) => Promise<T>): Promise<T> {
      const kidSnap = kids.map((kid) => ({ ...kid }))
      const entrySnap = new Map(entries)
      const staged: Array<() => void> = []
      const limit = options?.limit ?? 10
      const tx: LedgerTx = {
        async findKidsBySlug(slug) {
          const matched = kidSnap.filter((kid) => kid.slug === slug)
          const page = matched.slice(0, limit)
          return {
            kids: page.map((kid): KidSnapshot => ({
              id: kid.id,
              slug: kid.slug,
              parentId: kid.parentId,
              total: kid.total,
              totalValid: kid.totalValid !== false,
            })),
            scanned: page.length,
            limit,
          }
        },
        async readEntry(kidId, entryId): Promise<StoredEntry> {
          const found = entrySnap.get(`${kidId}/${entryId}`)
          return found ? { exists: true, ...found } : { exists: false }
        },
        createEntry(kidId, entryId, data: EntryWrite) {
          staged.push(() => {
            entries.set(`${kidId}/${entryId}`, {
              amount: data.amount,
              description: data.description,
              calendarDate: data.calendarDate,
              requestHash: data.requestHash,
            })
          })
        },
        incrementTotal(kidId, delta) {
          if (options?.failIncrement) throw new Error('increment failed')
          staged.push(() => {
            const kid = kids.find((item) => item.id === kidId)
            if (!kid) throw new Error('missing kid')
            kid.total = Number((kid.total + delta).toFixed(2))
          })
        },
      }
      const result = await fn(tx)
      for (const apply of staged) apply()
      return result
    },
  }

  return { store, kids, entries }
}
