import { KID_LOOKUP_LIMIT } from './constants'
import { AllowanceError } from './errors'
import { compareHistory, type HistoryRecord, type HistoryResume, type HistorySource } from './history'
import { timestampToDate } from './history-time'
import type { AllowedChild } from './constants'
import type { KidLookup, KidSnapshot } from './ledger'

const SAME_TIMESTAMP_LIMIT = 100

type Query = {
  where(field: string, op: string, value: unknown): Query
  orderBy(field: unknown, direction: 'asc' | 'desc'): Query
  startAfter(...values: unknown[]): Query
  limit(count: number): Query
  get(): Promise<{ docs: DocSnap[] }>
}

type DocSnap = {
  id: string
  get(field: string): unknown
}

type Collection = {
  where(field: string, op: string, value: unknown): Query
  limit(count: number): Query
  doc(id: string): { collection(name: string): Collection }
}

export type HistoryDb = {
  collection(name: string): Collection
}

export type HistoryCodec = {
  toTimestamp: (date: Date) => unknown
  fromTimestamp: (value: unknown) => Date | null
}

function kidSnapshot(id: string, get: (field: string) => unknown): KidSnapshot {
  const slug = get('slug')
  const parentId = get('parentId')
  const total = get('total')
  return {
    id,
    slug: typeof slug === 'string' ? slug : '',
    parentId: typeof parentId === 'string' ? parentId : '',
    total: typeof total === 'number' ? total : 0,
    totalValid: total === undefined || typeof total === 'number',
  }
}

/**
 * Date-range reads order only by `date`. Firestore already stores document
 * name as the tie-break on that single-field index. An explicit
 * orderBy(documentId()) is a second ordered field and is not how the website
 * reads this collection.
 */
export function historyReadQueries(
  collection: { where(field: string, op: string, value: unknown): Query },
  codec: HistoryCodec,
  input: { startMs: number; endMs: number; resume: HistoryResume; limit: number },
): Query[] {
  const end = codec.toTimestamp(new Date(input.endMs))
  if (input.resume.kind === 'after-id') {
    const at = codec.toTimestamp(new Date(input.resume.ms))
    return [
      collection.where('date', '==', at).limit(SAME_TIMESTAMP_LIMIT),
      collection.where('date', '>', at).where('date', '<', end).orderBy('date', 'asc').limit(input.limit),
    ]
  }
  const lowerMs = input.resume.kind === 'start' ? input.startMs : input.resume.ms
  const lowerOp = input.resume.kind === 'after-time' ? '>' : '>='
  return [
    collection
      .where('date', lowerOp, codec.toTimestamp(new Date(lowerMs)))
      .where('date', '<', end)
      .orderBy('date', 'asc')
      .limit(input.limit),
  ]
}

function mapTransaction(doc: DocSnap, child: AllowedChild, codec: HistoryCodec): HistoryRecord {
  const timestamp = codec.fromTimestamp(doc.get('date'))
  if (!timestamp) throw new AllowanceError('invalid_stored_entry', 500)
  const amount = doc.get('amount')
  const description = doc.get('description')
  return {
    id: doc.id,
    child,
    amount: typeof amount === 'number' ? amount : Number.NaN,
    description: typeof description === 'string' ? description : null,
    timestamp,
  }
}

export function createFirestoreHistorySource(db: HistoryDb, codec: HistoryCodec): HistorySource {
  const kids = db.collection('kids')
  return {
    async findKidsBySlug(slug): Promise<KidLookup> {
      const snap = await kids.where('slug', '==', slug).limit(KID_LOOKUP_LIMIT).get()
      return {
        kids: snap.docs.map((doc) => kidSnapshot(doc.id, (field) => doc.get(field))),
        scanned: snap.docs.length,
        limit: KID_LOOKUP_LIMIT,
      }
    },
    async readTransactions({ kidId, child, startMs, endMs, resume, limit }): Promise<HistoryRecord[]> {
      const queries = historyReadQueries(kids.doc(kidId).collection('transactions'), codec, {
        startMs,
        endMs,
        resume,
        limit,
      })
      const snaps = await Promise.all(queries.map((query) => query.get()))
      if (resume.kind === 'after-id' && snaps[0].docs.length >= SAME_TIMESTAMP_LIMIT) {
        throw new AllowanceError('result_window_exceeded', 500)
      }
      const rows = snaps.flatMap((snap) => snap.docs.map((doc) => mapTransaction(doc, child, codec)))
      const filtered = resume.kind === 'after-id'
        ? rows.filter((row) => row.timestamp.getTime() > resume.ms || (row.timestamp.getTime() === resume.ms && row.id > resume.id))
        : rows
      filtered.sort(compareHistory)
      return filtered.slice(0, limit)
    },
  }
}
