import {
  BOT_PARENT_EMAIL,
  BOT_PARENT_NAME,
  BOT_SOURCE,
  KID_LOOKUP_LIMIT,
} from './constants'
import type { EntryWrite, KidLookup, KidSnapshot, LedgerStore, LedgerTx, StoredEntry } from './ledger'

type Codec = {
  increment: (amount: number) => unknown
  timestamp: (date: Date) => unknown
}

type DocSnap = {
  id: string
  exists: boolean
  get(field: string): unknown
}

type QuerySnap = {
  size: number
  docs: DocSnap[]
}

type DocRef = {
  id: string
  collection(name: string): CollectionRef
}

type CollectionRef = {
  where(field: string, op: string, value: string): CollectionRef
  limit(count: number): CollectionRef
  doc(id: string): DocRef
}

type TxLike = {
  get(target: CollectionRef | DocRef): Promise<QuerySnap | DocSnap>
  set(ref: DocRef, data: Record<string, unknown>): void
  update(ref: DocRef, data: Record<string, unknown>): void
}

export type FirestoreDb = {
  collection(name: string): CollectionRef
  runTransaction<T>(fn: (tx: TxLike) => Promise<T>): Promise<T>
}

export function entryDocument(data: EntryWrite, timestamp: unknown): Record<string, unknown> {
  return {
    amount: data.amount,
    description: data.description,
    date: timestamp,
    calendarDate: data.calendarDate,
    parentName: BOT_PARENT_NAME,
    parentEmail: BOT_PARENT_EMAIL,
    source: BOT_SOURCE,
    requestHash: data.requestHash,
  }
}

export function totalUpdate(delta: number, increment: (amount: number) => unknown): Record<string, unknown> {
  return { total: increment(delta) }
}

function kidSnapshot(doc: DocSnap): KidSnapshot {
  const slug = doc.get('slug')
  const parentId = doc.get('parentId')
  const total = doc.get('total')
  const totalValid = total === undefined || typeof total === 'number'
  return {
    id: doc.id,
    slug: typeof slug === 'string' ? slug : '',
    parentId: typeof parentId === 'string' ? parentId : '',
    total: typeof total === 'number' ? total : 0,
    totalValid,
  }
}

function storedEntry(doc: DocSnap): StoredEntry {
  if (!doc.exists) return { exists: false }
  const amount = doc.get('amount')
  const description = doc.get('description')
  const calendarDate = doc.get('calendarDate')
  const requestHash = doc.get('requestHash')
  if (
    typeof amount !== 'number' ||
    typeof description !== 'string' ||
    typeof calendarDate !== 'string' ||
    typeof requestHash !== 'string'
  ) {
    return {
      exists: true,
      amount: typeof amount === 'number' ? amount : Number.NaN,
      description: typeof description === 'string' ? description : '',
      calendarDate: typeof calendarDate === 'string' ? calendarDate : '',
      requestHash: typeof requestHash === 'string' ? requestHash : '',
    }
  }
  return { exists: true, amount, description, calendarDate, requestHash }
}

function isQuerySnap(value: QuerySnap | DocSnap): value is QuerySnap {
  return 'docs' in value
}

export function createFirestoreLedgerStore(db: FirestoreDb, codec: Codec): LedgerStore {
  return {
    runTransaction(fn) {
      return db.runTransaction(async (tx) => {
        const kids = db.collection('kids')
        const adapter: LedgerTx = {
          async findKidsBySlug(slug) {
            const query = kids.where('slug', '==', slug).limit(KID_LOOKUP_LIMIT)
            const snap = await tx.get(query)
            if (!isQuerySnap(snap)) throw new Error('expected kid query snapshot')
            const lookup: KidLookup = {
              kids: snap.docs.map(kidSnapshot),
              scanned: snap.size,
              limit: KID_LOOKUP_LIMIT,
            }
            return lookup
          },
          async readEntry(kidId, entryId) {
            const ref = kids.doc(kidId).collection('transactions').doc(entryId)
            const snap = await tx.get(ref)
            if (isQuerySnap(snap)) throw new Error('expected entry document')
            return storedEntry(snap)
          },
          createEntry(kidId, entryId, data) {
            const ref = kids.doc(kidId).collection('transactions').doc(entryId)
            tx.set(ref, entryDocument(data, codec.timestamp(data.date)))
          },
          incrementTotal(kidId, delta) {
            tx.update(kids.doc(kidId), totalUpdate(delta, codec.increment))
          },
        }
        return fn(adapter)
      })
    },
  }
}
